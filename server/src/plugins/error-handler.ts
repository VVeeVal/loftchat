import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError, InternalServerError } from '../errors/app-errors.js';

export default async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: any, _req: FastifyRequest, reply: FastifyReply) => {
    if (reply.sent) {
      return;
    }

    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        details: error.details
      });
      return;
    }

    if (error instanceof ZodError) {
      reply.status(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
      return;
    }

    if (error?.name === 'PrismaClientKnownRequestError') {
      const prismaError = error as any;
      if (prismaError.code === 'P2002') {
        reply.status(409).send({
          error: 'Resource already exists',
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          details: prismaError.meta?.target
        });
        return;
      }

      if (prismaError.code === 'P2025') {
        reply.status(404).send({
          error: 'Resource not found',
          code: 'RECORD_NOT_FOUND'
        });
        return;
      }
    }

    if (error?.validation) {
      reply.status(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.validation
      });
      return;
    }

    app.log.error({
      error: error?.message,
      stack: error?.stack
    }, 'Unhandled error');

    const fallback = new InternalServerError();
    reply.status(fallback.statusCode).send({
      error: fallback.message,
      code: fallback.code
    });
  });
}
