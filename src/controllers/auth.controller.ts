import { Request, Response } from 'express';
import { BaseController } from './base.controller';
import { AuthenticatedRequest } from '@/middleware/auth-middleware';
import { db } from '@/db/connection';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export class AuthController extends BaseController {
  /**
   * Get current user profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUser = req.user!;

      // Get fresh user data from database
      const [userData] = await db.select({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }).from(user).where(eq(user.id, currentUser.id)).limit(1);

      if (!userData) {
        this.notFound(res, 'User not found');
        return;
      }

      this.success(res, { user: userData }, 'Profile retrieved successfully');

    } catch (error) {
      this.error(res, 'Failed to get profile', 500, error);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUser = req.user!;
      const { name, image } = req.body;

      // Validate at least one field is provided
      if (!name && !image) {
        this.validationError(res, { 
          general: 'At least one field (name or image) must be provided' 
        });
        return;
      }

      const updateData: Partial<{ name: string; image: string }> = {};

      // Validate and add name if provided
      if (name !== undefined) {
        if (!name.trim()) {
          this.validationError(res, { name: 'Name cannot be empty' });
          return;
        }
        updateData.name = name.trim();
      }

      // Add image if provided
      if (image !== undefined) {
        updateData.image = image;
      }

      // Update user
      const [updatedUser] = await db.update(user)
        .set(updateData)
        .where(eq(user.id, currentUser.id))
        .returning({
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          image: user.image,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        });

      if (!updatedUser) {
        this.error(res, 'Failed to update user', 500);
        return;
      }

      logger.info('User profile updated', { userId: currentUser.id, updatedFields: Object.keys(updateData) });

      this.success(res, { user: updatedUser }, 'Profile updated successfully');

    } catch (error) {
      this.error(res, 'Failed to update profile', 500, error);
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUser = req.user!;

      // Delete user account
      await db.delete(user).where(eq(user.id, currentUser.id));

      logger.info('User account deleted', { userId: currentUser.id });

      this.success(res, null, 'Account deleted successfully');

    } catch (error) {
      this.error(res, 'Failed to delete account', 500, error);
    }
  }

  /**
   * Get user statistics
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUser = req.user!;

      // Get user data for stats
      const [userData] = await db.select({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      }).from(user).where(eq(user.id, currentUser.id)).limit(1);

      if (!userData) {
        this.notFound(res, 'User not found');
        return;
      }

      // For now, return basic stats
      // This can be expanded to include job counts, usage statistics, etc.
      const stats = {
        userId: userData.id,
        accountCreated: userData.createdAt,
        emailVerified: userData.emailVerified,
        // Add more stats as needed
      };

      this.success(res, { stats }, 'User statistics retrieved successfully');

    } catch (error) {
      this.error(res, 'Failed to get user statistics', 500, error);
    }
  }
}