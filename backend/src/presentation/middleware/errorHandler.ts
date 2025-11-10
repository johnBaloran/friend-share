import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError.js';
import { env } from '../../config/env.js';
import { captureException } from '../../config/sentry.js';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Handle known application errors
  if (error instanceof AppError) {
    // Only capture server errors (5xx) in Sentry, not client errors (4xx)
    if (error.statusCode >= 500) {
      captureException(error, {
        url: req.url,
        method: req.method,
        userId: req.auth?.userId,
      });
    }

    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
  }

  // Log unexpected errors
  console.error('Unhandled error:', error);

  // Capture all unexpected errors in Sentry
  captureException(error, {
    url: req.url,
    method: req.method,
    userId: req.auth?.userId,
    body: req.body,
  });

  // Hide internal error details in production
  const message = env.isProduction() ? 'Internal server error' : error.message;

  return res.status(500).json({
    success: false,
    error: message,
    ...(env.isDevelopment() && { stack: error.stack }),
  });
};
