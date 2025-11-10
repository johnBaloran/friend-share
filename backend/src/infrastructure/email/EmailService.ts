import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { IEmailService, EmailOptions } from '../../core/interfaces/services/IEmailService.js';

export class EmailService implements IEmailService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  constructor() {
    this.fromEmail = env.get('EMAIL_FROM');

    // Create transporter based on environment
    const smtpHost = env.get('SMTP_HOST');
    const smtpPort = env.get('SMTP_PORT');
    const smtpSecure = env.get('SMTP_SECURE');
    const smtpUser = env.get('SMTP_USER');
    const smtpPass = env.get('SMTP_PASS');

    if (env.get('NODE_ENV') === 'production' && smtpHost && smtpUser && smtpPass) {
      // Production: Use SMTP (SendGrid, AWS SES, etc.)
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '587'),
        secure: smtpSecure === true,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    } else {
      // Development: Use Ethereal for testing or log emails
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: smtpUser || 'test@ethereal.email',
          pass: smtpPass || 'test',
        },
      });
    }

    this.transporter.verify((error) => {
      if (error) {
        console.error('Email service error:', error);
      } else {
        console.log('✅ Email service ready');
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (env.get('NODE_ENV') !== 'production') {
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(userEmail: string, userName: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Face Media Sharing!</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <p>Thank you for joining Face Media Sharing! We're excited to have you on board.</p>
              <p>With our platform, you can:</p>
              <ul>
                <li>Create groups and invite friends/family</li>
                <li>Upload and share photos automatically</li>
                <li>Use AI-powered face recognition to organize photos</li>
                <li>Download photos grouped by people</li>
              </ul>
              <p>Get started by creating your first group or joining an existing one!</p>
              <div class="footer">
                <p>Face Media Sharing - AI-powered photo sharing</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: userEmail,
      subject: 'Welcome to Face Media Sharing!',
      html,
    });
  }

  async sendGroupInviteEmail(
    userEmail: string,
    userName: string,
    groupName: string,
    inviteCode: string
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .invite-code { background: white; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; border: 2px dashed #667eea; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You've been invited to join a group!</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <p>You've been invited to join the group <strong>${groupName}</strong> on Face Media Sharing!</p>
              <p>Use the invite code below to join:</p>
              <div class="invite-code">${inviteCode}</div>
              <p>Once you join, you'll be able to share photos and view photos shared by other members.</p>
              <div class="footer">
                <p>Face Media Sharing - AI-powered photo sharing</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: userEmail,
      subject: `You've been invited to join ${groupName}`,
      html,
    });
  }

  async sendProcessingCompleteEmail(
    userEmail: string,
    userName: string,
    groupName: string,
    photoCount: number,
    faceCount: number
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .stats { display: flex; justify-content: space-around; margin: 20px 0; }
            .stat { text-align: center; }
            .stat-number { font-size: 36px; font-weight: bold; color: #667eea; }
            .stat-label { color: #666; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your photos are ready!</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <p>Great news! We've finished processing your photos in <strong>${groupName}</strong>.</p>
              <div class="stats">
                <div class="stat">
                  <div class="stat-number">${photoCount}</div>
                  <div class="stat-label">Photos Processed</div>
                </div>
                <div class="stat">
                  <div class="stat-number">${faceCount}</div>
                  <div class="stat-label">Faces Detected</div>
                </div>
              </div>
              <p>Your photos are now organized by face clusters. Visit the app to view and download them!</p>
              <div class="footer">
                <p>Face Media Sharing - AI-powered photo sharing</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: userEmail,
      subject: `Your photos in ${groupName} are ready!`,
      html,
    });
  }

  async sendStorageWarningEmail(
    userEmail: string,
    userName: string,
    groupName: string,
    storageUsedMB: number,
    storageLimitMB: number,
    percentageUsed: number
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .progress-bar { background: #e0e0e0; border-radius: 10px; height: 20px; overflow: hidden; }
            .progress-fill { background: #f5576c; height: 100%; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Storage Warning</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <div class="warning">
                <strong>Warning:</strong> Your group <strong>${groupName}</strong> is running out of storage space.
              </div>
              <p>Current storage usage:</p>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentageUsed}%"></div>
              </div>
              <p style="text-align: center; margin-top: 10px;">
                <strong>${storageUsedMB.toFixed(2)} MB / ${storageLimitMB.toFixed(2)} MB (${percentageUsed.toFixed(1)}%)</strong>
              </p>
              <p>To free up space, you can:</p>
              <ul>
                <li>Delete old or unwanted photos</li>
                <li>Download and archive photos locally</li>
                <li>Contact support to increase your storage limit</li>
              </ul>
              <div class="footer">
                <p>Face Media Sharing - AI-powered photo sharing</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: userEmail,
      subject: `Storage Warning: ${groupName} is ${percentageUsed.toFixed(1)}% full`,
      html,
    });
  }

  async sendDataExportReadyEmail(
    userEmail: string,
    userName: string,
    downloadUrl: string,
    expiresInHours: number
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .notice { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your data export is ready!</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <p>Your personal data export has been prepared and is ready for download.</p>
              <div class="notice">
                <strong>Important:</strong> This download link will expire in ${expiresInHours} hours for security reasons.
              </div>
              <p>Click the button below to download your data:</p>
              <a href="${downloadUrl}" class="button">Download My Data</a>
              <p>The export includes all your personal information, groups, and media metadata as per GDPR requirements.</p>
              <div class="footer">
                <p>Face Media Sharing - AI-powered photo sharing</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: userEmail,
      subject: 'Your data export is ready',
      html,
    });
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}
