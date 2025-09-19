import { BaseService, ServiceResponse } from './base.service';

export interface EmailNotification {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface PushNotification {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
}

/**
 * Service for managing notifications (email, push, etc.)
 */
export class NotificationService extends BaseService {
  /**
   * Send email notification
   */
  async sendEmail(notification: EmailNotification): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired(notification, ['to', 'subject', 'html']);
      this.logOperation('sendEmail', { to: notification.to, subject: notification.subject });

      // TODO: Implement actual email sending logic
      // This could use services like SendGrid, AWS SES, Nodemailer, etc.
      
      // For now, just log the email
      this.logger.info('Email notification sent', {
        to: notification.to,
        subject: notification.subject,
        hasHtml: !!notification.html,
        hasText: !!notification.text,
      });

      return this.createResponse(true, 'Email sent successfully');
    } catch (error) {
      this.handleError(error, 'Failed to send email notification');
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(notification: PushNotification): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired(notification, ['userId', 'title', 'body']);
      this.logOperation('sendPushNotification', { 
        userId: notification.userId, 
        title: notification.title 
      });

      // TODO: Implement actual push notification logic
      // This could use services like Firebase Cloud Messaging, OneSignal, etc.
      
      // For now, just log the notification
      this.logger.info('Push notification sent', {
        userId: notification.userId,
        title: notification.title,
        body: notification.body,
        hasData: !!notification.data,
      });

      return this.createResponse(true, 'Push notification sent successfully');
    } catch (error) {
      this.handleError(error, 'Failed to send push notification');
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(userEmail: string, userName: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ userEmail, userName }, ['userEmail', 'userName']);

      const emailNotification: EmailNotification = {
        to: userEmail,
        subject: 'Welcome to Stagingfy!',
        html: this.generateWelcomeEmailHtml(userName),
        text: this.generateWelcomeEmailText(userName),
      };

      return await this.sendEmail(emailNotification);
    } catch (error) {
      this.handleError(error, 'Failed to send welcome email');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(userEmail: string, resetToken: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ userEmail, resetToken }, ['userEmail', 'resetToken']);

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      const emailNotification: EmailNotification = {
        to: userEmail,
        subject: 'Reset Your Stagingfy Password',
        html: this.generatePasswordResetEmailHtml(resetUrl),
        text: this.generatePasswordResetEmailText(resetUrl),
      };

      return await this.sendEmail(emailNotification);
    } catch (error) {
      this.handleError(error, 'Failed to send password reset email');
    }
  }

  /**
   * Send subscription notification
   */
  async sendSubscriptionNotification(
    userEmail: string, 
    userName: string, 
    subscriptionType: string,
    isUpgrade: boolean = false
  ): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ userEmail, userName, subscriptionType }, ['userEmail', 'userName', 'subscriptionType']);

      const subject = isUpgrade 
        ? `Subscription Upgraded to ${subscriptionType}!`
        : `Welcome to ${subscriptionType}!`;

      const emailNotification: EmailNotification = {
        to: userEmail,
        subject,
        html: this.generateSubscriptionEmailHtml(userName, subscriptionType, isUpgrade),
        text: this.generateSubscriptionEmailText(userName, subscriptionType, isUpgrade),
      };

      return await this.sendEmail(emailNotification);
    } catch (error) {
      this.handleError(error, 'Failed to send subscription notification');
    }
  }

  /**
   * Generate welcome email HTML template
   */
  private generateWelcomeEmailHtml(userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Stagingfy</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Welcome to Stagingfy, ${userName}!</h1>
            <p>Thank you for joining Stagingfy. We're excited to have you on board!</p>
            <p>You can now start creating amazing staging environments for your projects.</p>
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Get Started
              </a>
            </div>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>The Stagingfy Team</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate welcome email text template
   */
  private generateWelcomeEmailText(userName: string): string {
    return `
      Welcome to Stagingfy, ${userName}!

      Thank you for joining Stagingfy. We're excited to have you on board!

      You can now start creating amazing staging environments for your projects.

      Get started: ${process.env.FRONTEND_URL}/dashboard

      If you have any questions, feel free to reach out to our support team.

      Best regards,
      The Stagingfy Team
    `;
  }

  /**
   * Generate password reset email HTML template
   */
  private generatePasswordResetEmailHtml(resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Reset Your Password</h1>
            <p>You requested to reset your password for your Stagingfy account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>Best regards,<br>The Stagingfy Team</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate password reset email text template
   */
  private generatePasswordResetEmailText(resetUrl: string): string {
    return `
      Reset Your Password

      You requested to reset your password for your Stagingfy account.

      Click the link below to reset your password:
      ${resetUrl}

      If you didn't request this password reset, please ignore this email.

      This link will expire in 1 hour for security reasons.

      Best regards,
      The Stagingfy Team
    `;
  }

  /**
   * Generate subscription email HTML template
   */
  private generateSubscriptionEmailHtml(userName: string, subscriptionType: string, isUpgrade: boolean): string {
    const action = isUpgrade ? 'upgraded' : 'subscribed';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Subscription ${isUpgrade ? 'Upgraded' : 'Confirmed'}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #16a34a;">Subscription ${isUpgrade ? 'Upgraded' : 'Confirmed'}!</h1>
            <p>Hi ${userName},</p>
            <p>You have successfully ${action} to the <strong>${subscriptionType}</strong> plan.</p>
            <p>You now have access to all the premium features included in your plan.</p>
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" 
                 style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Access Dashboard
              </a>
            </div>
            <p>Thank you for choosing Stagingfy!</p>
            <p>Best regards,<br>The Stagingfy Team</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate subscription email text template
   */
  private generateSubscriptionEmailText(userName: string, subscriptionType: string, isUpgrade: boolean): string {
    const action = isUpgrade ? 'upgraded' : 'subscribed';
    
    return `
      Subscription ${isUpgrade ? 'Upgraded' : 'Confirmed'}!

      Hi ${userName},

      You have successfully ${action} to the ${subscriptionType} plan.

      You now have access to all the premium features included in your plan.

      Access your dashboard: ${process.env.FRONTEND_URL}/dashboard

      Thank you for choosing Stagingfy!

      Best regards,
      The Stagingfy Team
    `;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();