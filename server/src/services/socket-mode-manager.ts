import { WebSocket } from '@fastify/websocket';
import { prisma } from '../db.js';
import { generateConnectionId } from './bot-token-generator.js';

/**
 * Socket Mode Manager
 * Manages WebSocket connections for Socket Mode apps
 */
class SocketModeManager {
  private connections = new Map<string, WebSocket>();
  private pingInterval = 30000; // 30 seconds
  private pingTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Registers a new Socket Mode connection
   *
   * @param appId - The app ID
   * @param organizationId - The organization ID
   * @param socket - The WebSocket connection
   * @returns The connection ID
   */
  async registerConnection(
    appId: string,
    organizationId: string,
    socket: WebSocket
  ): Promise<string> {
    const connectionId = generateConnectionId();

    // Store connection in memory
    this.connections.set(connectionId, socket);

    // Create database record
    await prisma.socketConnection.create({
      data: {
        connectionId,
        appId,
        organizationId,
        isActive: true,
        connectedAt: new Date(),
        lastPingAt: new Date()
      }
    });

    // Set up ping/pong heartbeat
    this.startHeartbeat(connectionId);

    // Handle socket events
    socket.on('close', () => {
      this.closeConnection(connectionId).catch((error) => {
        console.error(
          `Error closing connection ${connectionId}:`,
          error
        );
      });
    });

    socket.on('error', (error) => {
      console.error(
        `WebSocket error for connection ${connectionId}:`,
        error
      );
      this.closeConnection(connectionId).catch((err) => {
        console.error(
          `Error closing connection ${connectionId} after error:`,
          err
        );
      });
    });

    // Handle pong responses
    socket.on('pong', () => {
      this.updatePingTimestamp(connectionId).catch((error) => {
        console.error(
          `Error updating ping timestamp for ${connectionId}:`,
          error
        );
      });
    });

    // Send hello message
    this.send(socket, {
      type: 'hello',
      connection_info: {
        app_id: appId
      }
    });

    console.log(
      `Socket Mode connection registered: ${connectionId} ` +
      `(app: ${appId}, org: ${organizationId})`
    );

    return connectionId;
  }

  /**
   * Sends an event to a specific connection
   *
   * @param connectionId - The connection ID
   * @param event - The event payload
   */
  async sendEvent(connectionId: string, event: any): Promise<void> {
    const socket = this.connections.get(connectionId);

    if (!socket) {
      throw new Error(
        `Socket connection ${connectionId} not found`
      );
    }

    if (socket.readyState !== WebSocket.OPEN) {
      throw new Error(
        `Socket connection ${connectionId} is not open`
      );
    }

    // Wrap event in envelope
    const envelope = {
      envelope_id: `env_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: 'events_api',
      accepts_response_payload: false,
      payload: event
    };

    this.send(socket, envelope);
  }

  /**
   * Closes a connection
   *
   * @param connectionId - The connection ID to close
   */
  async closeConnection(connectionId: string): Promise<void> {
    // Stop heartbeat
    const timer = this.pingTimers.get(connectionId);
    if (timer) {
      clearInterval(timer);
      this.pingTimers.delete(connectionId);
    }

    // Close socket
    const socket = this.connections.get(connectionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
    this.connections.delete(connectionId);

    // Update database
    await prisma.socketConnection.updateMany({
      where: { connectionId },
      data: { isActive: false }
    });

    console.log(`Socket Mode connection closed: ${connectionId}`);
  }

  /**
   * Starts ping/pong heartbeat for a connection
   */
  private startHeartbeat(connectionId: string): void {
    const timer = setInterval(() => {
      const socket = this.connections.get(connectionId);

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        // Connection is dead, clean up
        this.closeConnection(connectionId).catch((error) => {
          console.error(
            `Error closing dead connection ${connectionId}:`,
            error
          );
        });
        return;
      }

      // Send ping
      socket.ping();
    }, this.pingInterval);

    this.pingTimers.set(connectionId, timer);
  }

  /**
   * Updates the last ping timestamp for a connection
   */
  private async updatePingTimestamp(connectionId: string): Promise<void> {
    await prisma.socketConnection.updateMany({
      where: { connectionId },
      data: { lastPingAt: new Date() }
    });
  }

  /**
   * Sends a message over a WebSocket
   */
  private send(socket: WebSocket, message: any): void {
    socket.send(JSON.stringify(message));
  }

  /**
   * Gets all active connections for an app
   *
   * @param appId - The app ID
   * @param organizationId - The organization ID
   * @returns Array of connection IDs
   */
  async getActiveConnections(
    appId: string,
    organizationId: string
  ): Promise<string[]> {
    const connections = await prisma.socketConnection.findMany({
      where: {
        appId,
        organizationId,
        isActive: true
      },
      select: {
        connectionId: true
      }
    });

    return connections.map((c) => c.connectionId);
  }

  /**
   * Cleans up stale connections that haven't pinged recently
   *
   * @param maxAgeMinutes - Maximum age in minutes without ping
   */
  async cleanupStaleConnections(maxAgeMinutes: number = 5): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - maxAgeMinutes);

    const staleConnections = await prisma.socketConnection.findMany({
      where: {
        isActive: true,
        lastPingAt: { lt: cutoffDate }
      }
    });

    // Close each stale connection
    for (const connection of staleConnections) {
      await this.closeConnection(connection.connectionId);
    }

    return staleConnections.length;
  }

  /**
   * Broadcasts an event to all connections for an app
   *
   * @param appId - The app ID
   * @param organizationId - The organization ID
   * @param event - The event to broadcast
   */
  async broadcast(
    appId: string,
    organizationId: string,
    event: any
  ): Promise<number> {
    const connectionIds = await this.getActiveConnections(appId, organizationId);

    let successCount = 0;
    for (const connectionId of connectionIds) {
      try {
        await this.sendEvent(connectionId, event);
        successCount++;
      } catch (error) {
        console.error(
          `Failed to send event to connection ${connectionId}:`,
          error
        );
      }
    }

    return successCount;
  }
}

// Export singleton instance
export const socketModeManager = new SocketModeManager();

// Run cleanup every 5 minutes
setInterval(() => {
  socketModeManager.cleanupStaleConnections().catch((error) => {
    console.error('Error cleaning up stale socket connections:', error);
  });
}, 5 * 60 * 1000);
