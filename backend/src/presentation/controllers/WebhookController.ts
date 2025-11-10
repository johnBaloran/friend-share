import { Request, Response } from 'express';
import { IAuthService } from '../../core/interfaces/services/IAuthService.js';
import { IEmailService } from '../../core/interfaces/services/IEmailService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export class WebhookController {
  constructor(
    private authService: IAuthService,
    private emailService: IEmailService
  ) {}

  /**
   * Handle Clerk webhook events
   * POST /api/webhooks/clerk
   */
  handleClerkWebhook = asyncHandler(async (req: Request, res: Response) => {
    const payload = JSON.stringify(req.body);
    const headers = req.headers;

    // Get the Svix headers for verification
    const svixId = headers['svix-id'] as string;
    const svixTimestamp = headers['svix-timestamp'] as string;
    const svixSignature = headers['svix-signature'] as string;

    // If there are no headers, error out
    if (!svixId || !svixTimestamp || !svixSignature) {
      return res.status(400).json({
        success: false,
        error: 'Missing svix headers',
      });
    }

    // Verify the webhook signature
    const isValid = this.authService.verifyWebhookSignature(
      payload,
      svixSignature
    );

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature',
      });
    }

    const { type, data } = req.body;

    console.log(`📨 Webhook received: ${type}`);

    try {
      switch (type) {
        case 'user.created':
          await this.handleUserCreated(data);
          break;

        case 'user.updated':
          await this.handleUserUpdated(data);
          break;

        case 'user.deleted':
          await this.handleUserDeleted(data);
          break;

        default:
          console.log(`⚠️ Unhandled webhook type: ${type}`);
      }

      return res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process webhook',
      });
    }
  });

  /**
   * Handle user.created event
   */
  private async handleUserCreated(data: any): Promise<void> {
    console.log(`✅ Creating user: ${data.id}`);

    const clerkUser = {
      id: data.id,
      emailAddresses: data.email_addresses.map((email: any) => ({
        emailAddress: email.email_address,
        id: email.id,
      })),
      firstName: data.first_name,
      lastName: data.last_name,
      imageUrl: data.image_url,
      emailVerified: data.email_addresses[0]?.verification?.status === 'verified',
    };

    await this.authService.syncUser(clerkUser);

    // Send welcome email
    try {
      const userEmail = data.email_addresses[0]?.email_address;
      const userName = data.first_name || 'there';

      if (userEmail) {
        await this.emailService.sendWelcomeEmail(userEmail, userName);
        console.log(`📧 Welcome email sent to ${userEmail}`);
      }
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't throw - we don't want to fail the webhook if email fails
    }
  }

  /**
   * Handle user.updated event
   */
  private async handleUserUpdated(data: any): Promise<void> {
    console.log(`📝 Updating user: ${data.id}`);

    const clerkUser = {
      id: data.id,
      emailAddresses: data.email_addresses.map((email: any) => ({
        emailAddress: email.email_address,
        id: email.id,
      })),
      firstName: data.first_name,
      lastName: data.last_name,
      imageUrl: data.image_url,
      emailVerified: data.email_addresses[0]?.verification?.status === 'verified',
    };

    await this.authService.syncUser(clerkUser);
  }

  /**
   * Handle user.deleted event
   */
  private async handleUserDeleted(data: any): Promise<void> {
    console.log(`🗑️ User deleted: ${data.id}`);
    // You might want to implement soft delete or cleanup logic here
    // For now, we'll just log it
  }
}
