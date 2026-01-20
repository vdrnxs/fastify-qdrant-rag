import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ErrorResponse } from '../types';

export function errorHandler(
  error: FastifyError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Zod validation errors
  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      error: 'Validation failed',
      details: error.issues
    };
    return reply.code(400).send(response);
  }

  // Log error for debugging
  request.log.error(error);

  // Generic error response
  const response: ErrorResponse = {
    error: error.message || 'Internal server error'
  };

  const statusCode = error.statusCode || 500;
  return reply.code(statusCode).send(response);
}
