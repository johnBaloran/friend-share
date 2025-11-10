import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { env } from './env.js';

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export function initSentry(): void {
  const sentryDsn = env.get('SENTRY_DSN');

  // Only initialize if DSN is provided
  if (!sentryDsn) {
    console.warn('⚠️  SENTRY_DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: env.get('NODE_ENV'),

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // Adjust this value in production to reduce volume
    tracesSampleRate: env.isProduction() ? 0.1 : 1.0,

    // Set sampling rate for profiling
    // This is relative to tracesSampleRate
    profilesSampleRate: env.isProduction() ? 0.1 : 1.0,

    integrations: [
      // Enable profiling
      nodeProfilingIntegration(),
    ],

    // Ignore specific errors
    ignoreErrors: [
      // Browser errors
      /Loading chunk/i,
      /ChunkLoadError/i,
      // Network errors
      /NetworkError/i,
      /Network request failed/i,
      // Common non-critical errors
      /cancelled/i,
      /timeout/i,
    ],

    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (env.isDevelopment() && !env.get('SENTRY_ENABLED_IN_DEV')) {
        return null;
      }

      // Filter out specific error messages
      const error = hint.originalException as Error;
      if (error?.message) {
        // Don't track validation errors (they're user errors, not bugs)
        if (error.message.includes('Validation failed')) {
          return null;
        }
        // Don't track auth errors (they're expected)
        if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
          return null;
        }
      }

      return event;
    },
  });

  console.log('✅ Sentry initialized for error tracking');
}

/**
 * Manually capture an exception
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.setContext('custom', context);
  }
  Sentry.captureException(error);
}

/**
 * Manually capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}

/**
 * Add user context to Sentry events
 */
export function setUser(userId: string, email?: string): void {
  Sentry.setUser({ id: userId, email });
}

/**
 * Clear user context
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

export { Sentry };
