import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: unknown = undefined;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    details = error.issues.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));
  }
  // Handle custom app errors
  else if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
  }
  // Handle known operational errors
  else if (error.isOperational) {
    statusCode = 400;
    message = error.message;
  }

  // Log error
  logger.error(`${req.method} ${req.path} - ${message}`, {
    statusCode,
    stack: error.stack,
    body: req.body,
    query: req.query,
    params: req.params,
  });



  // Send error response
  const errorResponse: Record<string, unknown> = {
    success: false,
    error: {
      message,
    },
  };

  if (details) {
    (errorResponse.error as Record<string, unknown>).details = details;
  }

  if (process.env.NODE_ENV === 'development') {
    (errorResponse.error as Record<string, unknown>).stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};