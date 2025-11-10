import { User } from '../../entities/User.js';

export interface ClerkUser {
  id: string;
  emailAddresses: Array<{
    emailAddress: string;
    id: string;
  }>;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  emailVerified?: boolean;
}

export interface IAuthService {
  /**
   * Validate a Clerk JWT token and return the user ID
   */
  validateToken(token: string): Promise<string>;

  /**
   * Get user details from Clerk by Clerk user ID
   */
  getUserFromClerk(clerkUserId: string): Promise<ClerkUser>;

  /**
   * Sync Clerk user to local database
   */
  syncUser(clerkUser: ClerkUser): Promise<User>;

  /**
   * Verify webhook signature from Clerk
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;

  /**
   * Delete a user from Clerk (GDPR Right to Erasure)
   */
  deleteUser(clerkUserId: string): Promise<void>;
}
