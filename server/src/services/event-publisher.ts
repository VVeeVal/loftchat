import { prisma } from '../db.js';
import { checkRateLimit, incrementRateLimit, RateLimitTier } from '../middleware/rate-limiter.js';
import { EventDeliveryStatus } from '@prisma/client';

/**
 * Event publisher service
 * Publishes events to subscribed apps via webhook or socket mode
 */
class EventPublisher {
  private retryDelays = [2000, 4000, 8000]; // Exponential backoff: 2s, 4s, 8s

  /**
   * Publishes an event to all subscribed apps in an organization
   *
   * @param organizationId - The organization where the event occurred
   * @param eventType - The Slack event type (e.g., 'message.channels')
   * @param payload - The event payload (should be a Slack-formatted event)
   */
  async publishEvent(
    organizationId: string,
    eventType: string,
    payload: any
  ): Promise<void> {
    // Find all active app installations that subscribe to this event type
    const subscriptions = await prisma.eventSubscription.findMany({
      where: {
        eventType,
        app: {
          installations: {
            some: {
              organizationId,
              isActive: true
            }
          }
        }
      },
      include: {
        app: {
          include: {
            installations: {
              where: {
                organizationId,
                isActive: true
              }
            }
          }
        }
      }
    });

    // Publish to each subscribed app
    for (const subscription of subscriptions) {
      const app = subscription.app;

      // Check rate limit
      const rateLimit = checkRateLimit(
        app.id,
        organizationId,
        RateLimitTier.EVENTS
      );

      if (rateLimit.limited) {
        console.warn(
          `Rate limit exceeded for app ${app.id} in org ${organizationId}. ` +
          `Event type: ${eventType}. Retry after: ${rateLimit.retryAfter}s`
        );
        continue;
      }

      // Increment rate limit counter
      incrementRateLimit(app.id, organizationId, RateLimitTier.EVENTS);

      // Determine delivery method
      if (app.socketModeEnabled) {
        // Send via Socket Mode
        await this.sendViaSocketMode(app.id, organizationId, eventType, payload);
      } else if (app.webhookUrl) {
        // Send via webhook
        await this.sendViaWebhook(app.id, organizationId, eventType, payload, app.webhookUrl);
      } else {
        console.warn(
          `App ${app.id} has no delivery method configured (no webhook URL or socket mode)`
        );
      }
    }
  }

  /**
   * Sends an event via HTTP webhook
   */
  private async sendViaWebhook(
    appId: string,
    organizationId: string,
    eventType: string,
    payload: any,
    webhookUrl: string
  ): Promise<void> {
    // Create event delivery record
    const delivery = await prisma.eventDelivery.create({
      data: {
        appId,
        organizationId,
        eventType,
        payload: JSON.stringify(payload),
        status: EventDeliveryStatus.PENDING,
        attempts: 0
      }
    });

    // Attempt delivery (don't await - fire and forget with retries)
    this.attemptWebhookDelivery(delivery.id, webhookUrl, payload).catch((error) => {
      console.error(
        `Failed to deliver event ${delivery.id} to ${webhookUrl}:`,
        error
      );
    });
  }

  /**
   * Attempts to deliver an event via webhook with retry logic
   */
  private async attemptWebhookDelivery(
    deliveryId: string,
    webhookUrl: string,
    payload: any,
    attemptNumber: number = 0
  ): Promise<void> {
    try {
      // Update attempt count
      await prisma.eventDelivery.update({
        where: { id: deliveryId },
        data: {
          attempts: attemptNumber + 1,
          lastAttemptAt: new Date(),
          status: EventDeliveryStatus.RETRYING
        }
      });

      // Send HTTP POST request
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Loft-Hookbot/1.0'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });

      if (response.ok) {
        // Success!
        await prisma.eventDelivery.update({
          where: { id: deliveryId },
          data: {
            status: EventDeliveryStatus.DELIVERED,
            succeededAt: new Date()
          }
        });
      } else {
        // HTTP error response
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if we should retry
      if (attemptNumber < this.retryDelays.length) {
        // Schedule retry
        const delay = this.retryDelays[attemptNumber];
        const nextRetryAt = new Date(Date.now() + delay);

        await prisma.eventDelivery.update({
          where: { id: deliveryId },
          data: {
            status: EventDeliveryStatus.RETRYING,
            nextRetryAt,
            errorMessage
          }
        });

        // Schedule retry
        setTimeout(() => {
          this.attemptWebhookDelivery(
            deliveryId,
            webhookUrl,
            payload,
            attemptNumber + 1
          ).catch((retryError) => {
            console.error(
              `Retry ${attemptNumber + 1} failed for delivery ${deliveryId}:`,
              retryError
            );
          });
        }, delay);
      } else {
        // Max retries exceeded
        await prisma.eventDelivery.update({
          where: { id: deliveryId },
          data: {
            status: EventDeliveryStatus.FAILED,
            errorMessage: `Failed after ${attemptNumber + 1} attempts: ${errorMessage}`
          }
        });

        console.error(
          `Event delivery ${deliveryId} failed after ${attemptNumber + 1} attempts`
        );
      }
    }
  }

  /**
   * Sends an event via Socket Mode (WebSocket)
   */
  private async sendViaSocketMode(
    appId: string,
    organizationId: string,
    eventType: string,
    payload: any
  ): Promise<void> {
    // Import socket mode manager dynamically to avoid circular dependency
    const { socketModeManager } = await import('./socket-mode-manager.js');

    // Find active socket connections for this app/org
    const connections = await prisma.socketConnection.findMany({
      where: {
        appId,
        organizationId,
        isActive: true
      }
    });

    if (connections.length === 0) {
      console.warn(
        `No active socket connections for app ${appId} in org ${organizationId}`
      );
      return;
    }

    // Send to all active connections
    for (const connection of connections) {
      try {
        await socketModeManager.sendEvent(connection.connectionId, payload);
      } catch (error) {
        console.error(
          `Failed to send event via socket connection ${connection.connectionId}:`,
          error
        );
      }
    }
  }

  /**
   * Retries all pending/failed event deliveries
   * (useful for background job or manual trigger)
   */
  async retryFailedDeliveries(): Promise<number> {
    const failedDeliveries = await prisma.eventDelivery.findMany({
      where: {
        status: {
          in: [EventDeliveryStatus.PENDING, EventDeliveryStatus.RETRYING, EventDeliveryStatus.FAILED]
        },
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } }
        ],
        attempts: { lt: 3 }
      },
      include: {
        app: true
      }
    });

    for (const delivery of failedDeliveries) {
      if (delivery.app.webhookUrl) {
        const payload = JSON.parse(delivery.payload);
        this.attemptWebhookDelivery(
          delivery.id,
          delivery.app.webhookUrl,
          payload,
          delivery.attempts
        ).catch((error) => {
          console.error(
            `Failed to retry delivery ${delivery.id}:`,
            error
          );
        });
      }
    }

    return failedDeliveries.length;
  }

  /**
   * Cleans up old event delivery records
   *
   * @param daysToKeep - Number of days to keep delivery records
   */
  async cleanupOldDeliveries(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.eventDelivery.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: EventDeliveryStatus.DELIVERED
      }
    });

    return result.count;
  }
}

// Export singleton instance
export const eventPublisher = new EventPublisher();
