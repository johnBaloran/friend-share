import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError.js';
import { env } from '../../config/env.js';

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
  }

  // Log unexpected errors
  console.error('Unhandled error:', error);

  // Hide internal error details in production
  const message = env.isProduction() ? 'Internal server error' : error.message;

  return res.status(500).json({
    success: false,
    error: message,
    ...(env.isDevelopment() && { stack: error.stack }),
  });
};
