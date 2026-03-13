import { prisma } from '../db.js';
import { generateResponseToken } from './bot-token-generator.js';

/**
 * Response token store for delayed responses
 * Maps response tokens to their metadata
 */
interface ResponseTokenData {
  channelId: string;
  userId: string;
  organizationId: string;
  expiresAt: Date;
}

class SlashCommandHandler {
  private responseTokens = new Map<string, ResponseTokenData>();

  /**
   * Executes a slash command
   *
   * @param command - The command string (e.g., "/hello")
   * @param text - The command arguments
   * @param userId - The user who triggered the command
   * @param channelId - The channel where the command was triggered
   * @param organizationId - The organization ID
   * @returns The command response or null if async
   */
  async executeCommand(
    command: string,
    text: string,
    userId: string,
    channelId: string,
    organizationId: string
  ): Promise<any> {
    // Find the registered slash command
    const slashCommand = await prisma.slashCommand.findFirst({
      where: {
        command,
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
        app: true
      }
    });

    if (!slashCommand) {
      return {
        response_type: 'ephemeral',
        text: `Unknown command: ${command}`
      };
    }

    // Generate response_url token
    const responseToken = generateResponseToken();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minute expiry

    this.responseTokens.set(responseToken, {
      channelId,
      userId,
      organizationId,
      expiresAt
    });

    // Clean up expired tokens (async)
    this.cleanupExpiredTokens();

    // Prepare Slack-compatible payload
    const payload = {
      token: 'deprecated', // Slack deprecated this
      team_id: organizationId,
      team_domain: organizationId,
      channel_id: channelId,
      channel_name: channelId,
      user_id: userId,
      user_name: userId,
      command,
      text,
      api_app_id: slashCommand.appId,
      response_url: `${process.env.BETTER_AUTH_URL?.replace('/api/auth', '')}/api/slash/response/${responseToken}`,
      trigger_id: `${Date.now()}.${Math.random()}`
    };

    try {
      // Send command to app's request URL
      const response = await fetch(slashCommand.requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(payload as any).toString(),
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });

      if (!response.ok) {
        console.error(
          `Slash command ${command} failed: HTTP ${response.status}`
        );
        return {
          response_type: 'ephemeral',
          text: `Command failed: ${response.statusText}`
        };
      }

      // Check if there's a response body
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const result = await response.json();
        return result;
      }

      // No immediate response - app will use response_url later
      return null;
    } catch (error) {
      console.error(
        `Error executing slash command ${command}:`,
        error
      );
      return {
        response_type: 'ephemeral',
        text: 'Command execution failed'
      };
    }
  }

  /**
   * Handles a delayed response via response_url
   *
   * @param token - The response token
   * @param response - The response payload
   * @returns Success/failure status
   */
  async handleDelayedResponse(
    token: string,
    response: any
  ): Promise<{ ok: boolean; error?: string }> {
    const tokenData = this.responseTokens.get(token);

    if (!tokenData) {
      return {
        ok: false,
        error: 'invalid_token'
      };
    }

    // Check if token is expired
    if (tokenData.expiresAt < new Date()) {
      this.responseTokens.delete(token);
      return {
        ok: false,
        error: 'token_expired'
      };
    }

    // Process the response
    try {
      await this.postCommandResponse(
        tokenData.channelId,
        tokenData.userId,
        tokenData.organizationId,
        response
      );

      // Delete the token after use (one-time use)
      this.responseTokens.delete(token);

      return { ok: true };
    } catch (error) {
      console.error(
        `Error handling delayed response for token ${token}:`,
        error
      );
      return {
        ok: false,
        error: 'processing_failed'
      };
    }
  }

  /**
   * Posts a command response to a channel
   *
   * @param channelId - The channel ID
   * @param userId - The user ID (for ephemeral messages)
   * @param organizationId - The organization ID
   * @param response - The response payload
   */
  private async postCommandResponse(
    channelId: string,
    userId: string,
    organizationId: string,
    response: any
  ): Promise<void> {
    const isEphemeral = response.response_type === 'ephemeral';
    const text = response.text || '';
    const attachments = response.attachments || [];
    const blocks = response.blocks || [];

    if (isEphemeral) {
      // For ephemeral messages, we would need to use the realtime system
      // to send a message visible only to the specific user
      // This would require integration with the realtime.ts WebSocket system
      console.log(
        `Ephemeral message for user ${userId} in channel ${channelId}: ${text}`
      );
      // TODO: Implement ephemeral message delivery via WebSocket
    } else {
      // Post as regular message
      // Find a bot user for this org (use system bot or first available)
      const botUser = await prisma.botUser.findFirst({
        where: {
          organizationId,
          isActive: true
        }
      });

      if (!botUser) {
        console.error(
          `No bot user found for org ${organizationId} to post command response`
        );
        return;
      }

      // Create the message
      await prisma.message.create({
        data: {
          content: text,
          channelId,
          senderId: botUser.userId,
          createdAt: new Date()
        }
      });
    }
  }

  /**
   * Cleans up expired response tokens
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [token, data] of this.responseTokens.entries()) {
      if (data.expiresAt < now) {
        this.responseTokens.delete(token);
      }
    }
  }

  /**
   * Gets all registered slash commands for an organization
   *
   * @param organizationId - The organization ID
   * @returns Array of slash commands
   */
  async getCommandsForOrganization(organizationId: string): Promise<any[]> {
    const commands = await prisma.slashCommand.findMany({
      where: {
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
          select: {
            id: true,
            name: true,
            iconUrl: true
          }
        }
      }
    });

    return commands.map((cmd) => ({
      id: cmd.id,
      command: cmd.command,
      description: cmd.description,
      usage_hint: cmd.usageHint,
      app: cmd.app
    }));
  }
}

// Export singleton instance
export const slashCommandHandler = new SlashCommandHandler();

// Run token cleanup every 10 minutes
setInterval(() => {
  (slashCommandHandler as any).cleanupExpiredTokens();
}, 10 * 60 * 1000);
