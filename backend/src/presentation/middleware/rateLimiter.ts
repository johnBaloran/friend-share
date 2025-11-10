import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  },
});

/**
 * Strict rate limiter for auth and sensitive endpoints
 * 10 requests per 15 minutes per IP
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    error: 'Too many requests to this endpoint, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many attempts. Please try again later.',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  },
});

/**
 * Upload rate limiter
 * 20 uploads per 15 minutes per IP
 * More restrictive since uploads are resource-intensive
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    error: 'Upload limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many uploads. Please wait before uploading more files.',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  },
});

/**
 * Download rate limiter
 * 50 downloads per 15 minutes per IP
 */
export const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: {
    success: false,
    error: 'Download limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many downloads. Please wait before downloading more files.',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  },
});

/**
 * Webhook rate limiter
 * More lenient for external services like Clerk
 * 200 requests per 15 minutes
 */
export const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: {
    success: false,
    error: 'Webhook rate limit exceeded.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Webhook rate limit exceeded. Please contact support.',
    });
  },
});

/**
 * Read-only operations rate limiter
 * More lenient for GET requests
 * 200 requests per 15 minutes per IP
 */
export const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please slow down.',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  },
});

/**
 * Image proxy rate limiter
 * Very lenient for image serving (cached content)
 * 1000 requests per 15 minutes per IP
 */
export const imageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    success: false,
    error: 'Too many image requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests (images are cached)
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many image requests. Please slow down.',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  },
});
