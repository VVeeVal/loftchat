import { FastifyInstance } from 'fastify';
import { requireOrganization } from '../organization-middleware.js';
import { AuthenticatedRequest } from '../types/request.js';
import { slashCommandHandler } from '../services/slash-command-handler.js';
import { BadRequestError } from '../errors/app-errors.js';
import { formatError, formatSuccess } from '../utils/slack-formatter.js';

/**
 * Slash command routes
 * Handles slash command execution and delayed responses
 */
export default async function slashCommandRoutes(app: FastifyInstance) {
  // Execute a slash command
  // This endpoint is called from the loft UI when a user types a slash command
  app.post<{
    Body: {
      command: string;
      text: string;
      channel_id: string;
    };
  }>('/slash/execute', {
    preHandler: requireOrganization
  }, async (req, res) => {
    const { command, text, channel_id } = req.body;
    const orgContext = (req as AuthenticatedRequest).organizationContext!;
    const user = (req as AuthenticatedRequest).user!;

    if (!command) {
      throw new BadRequestError('Command is required');
    }

    // Ensure command starts with /
    const normalizedCommand = command.startsWith('/') ? command : `/${command}`;

    try {
      const result = await slashCommandHandler.executeCommand(
        normalizedCommand,
        text || '',
        user.id,
        channel_id,
        orgContext.organizationId
      );

      if (result) {
        // Immediate response
        return result;
      } else {
        // Async response (app will use response_url)
        return {
          response_type: 'ephemeral',
          text: 'Command received...'
        };
      }
    } catch (error) {
      console.error('Error executing slash command:', error);
      return {
        response_type: 'ephemeral',
        text: 'An error occurred while executing the command'
      };
    }
  });

  // Handle delayed response via response_url
  // This endpoint is called by external apps to send delayed responses
  app.post<{
    Params: { token: string };
    Body: {
      text?: string;
      response_type?: 'in_channel' | 'ephemeral';
      attachments?: any[];
      blocks?: any[];
    };
  }>('/slash/response/:token', async (req, res) => {
    const { token } = req.params;
    const response = req.body;

    try {
      const result = await slashCommandHandler.handleDelayedResponse(
        token,
        response
      );

      if (result.ok) {
        return formatSuccess({});
      } else {
        return formatError(result.error || 'unknown_error');
      }
    } catch (error) {
      console.error('Error handling delayed response:', error);
      return formatError('internal_error');
    }
  });

  // List available slash commands for the current organization
  app.get('/slash/commands', {
    preHandler: requireOrganization
  }, async (req, res) => {
    const orgContext = (req as AuthenticatedRequest).organizationContext!;

    const commands = await slashCommandHandler.getCommandsForOrganization(
      orgContext.organizationId
    );

    return { commands };
  });
}
