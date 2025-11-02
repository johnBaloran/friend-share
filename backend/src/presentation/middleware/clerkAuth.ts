import { Request, Response, NextFunction } from 'express';
import { IAuthService } from '../../core/interfaces/services/IAuthService.js';
import { container } from '../../di/container.js';

/**
 * Middleware to check if user is authenticated via Clerk
 * Returns 401 JSON instead of redirecting for API endpoints
 * Also syncs user to database if not already present
 */
export const requireAuthJson = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth || !req.auth.userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Please sign in',
    });
  }

  try {
    // Sync user from Clerk to database
    const authService = container.get<IAuthService>('AuthService');
    const clerkUser = await authService.getUserFromClerk(req.auth.userId);
    await authService.syncUser(clerkUser);
  } catch (error) {
    console.error('Error syncing user:', error);
    // Continue even if sync fails - user is still authenticated
  }

  return next();
};
