import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';
import { BadRequestError } from '../../shared/errors/AppError.js';

/**
 * Validation middleware factory
 * Creates a middleware function that validates request data against a Zod schema
 */
export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Validate request data
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod validation errors into readable messages
        const errorMessages = error.issues.map((err) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        });

        throw new BadRequestError(`Validation failed: ${errorMessages.join(', ')}`);
      }

      // Pass other errors to error handler
      next(error);
    }
  };
};

/**
 * Sanitize request body by removing undefined/null values
 * Useful for preventing database pollution with empty fields
 */
export const sanitizeBody = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] === undefined || req.body[key] === null || req.body[key] === '') {
        delete req.body[key];
      }
    });
  }
  next();
};
