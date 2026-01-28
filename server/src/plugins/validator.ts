import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodSchema } from 'zod';
import { ValidationError } from '../errors/app-errors.js';

export function validateBody(schema: ZodSchema) {
  return async (req: FastifyRequest, res: FastifyReply) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.errors);
    }
    req.body = result.data;
  };
}

export function validateParams(schema: ZodSchema) {
  return async (req: FastifyRequest, res: FastifyReply) => {
    const rawParams = req.params as unknown;
    const normalizedParams = typeof rawParams === 'string'
      ? { id: rawParams }
      : rawParams ?? {};
    const result = schema.safeParse(normalizedParams);
    if (!result.success) {
      throw new ValidationError(result.error.errors, 'Invalid parameters');
    }
    req.params = result.data;
  };
}
