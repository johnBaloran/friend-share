import { clerkClient } from '@clerk/express';
import { Webhook } from 'svix';
import { IAuthService, ClerkUser } from '../../core/interfaces/services/IAuthService.js';
import { User } from '../../core/entities/User.js';
import { IUserRepository } from '../../core/interfaces/repositories/IUserRepository.js';

export class ClerkService implements IAuthService {
  private webhookSecret: string;

  constructor(private userRepository: IUserRepository) {
    this.webhookSecret = process.env.CLERK_WEBHOOK_SECRET || '';

    if (!this.webhookSecret) {
      console.warn('⚠️ CLERK_WEBHOOK_SECRET not set - webhook verification will fail');
    }
  }

  async validateToken(_token: string): Promise<string> {
    // Clerk Express middleware handles token validation automatically
    // This method is here for interface compliance
    throw new Error('Use Clerk Express middleware for token validation');
  }

  async getUserFromClerk(clerkUserId: string): Promise<ClerkUser> {
    try {
      const user = await clerkClient.users.getUser(clerkUserId);

      return {
        id: user.id,
        emailAddresses: user.emailAddresses.map(email => ({
          emailAddress: email.emailAddress,
          id: email.id,
        })),
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        imageUrl: user.imageUrl,
        emailVerified: user.emailAddresses[0]?.verification?.status === 'verified',
      };
    } catch (error) {
      console.error('Failed to get user from Clerk:', error);
      throw error;
    }
  }

  async syncUser(clerkUser: ClerkUser): Promise<User> {
    try {
      // Check if user already exists
      let user = await this.userRepository.findByClerkId(clerkUser.id);

      const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ');

      if (!user) {
        // Create new user
        user = await this.userRepository.create(
          User.create({
            clerkId: clerkUser.id,
            email: clerkUser.emailAddresses[0].emailAddress,
            name: fullName || undefined,
            avatar: clerkUser.imageUrl,
            emailVerified: clerkUser.emailVerified ? new Date() : undefined,
          })
        );
      } else {
        // Update existing user
        user = (await this.userRepository.update(user.id, {
          name: fullName || user.name,
          avatar: clerkUser.imageUrl || user.avatar,
          email: clerkUser.emailAddresses[0].emailAddress,
        }))!;
      }

      return user;
    } catch (error) {
      console.error('Failed to sync user:', error);
      throw error;
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.error('❌ Cannot verify webhook - CLERK_WEBHOOK_SECRET not set');
      return false;
    }

    try {
      const webhook = new Webhook(this.webhookSecret);
      // Svix verify will throw an error if verification fails
      webhook.verify(payload, {
        'svix-signature': signature,
      } as any);
      return true;
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      return false;
    }
  }
}
