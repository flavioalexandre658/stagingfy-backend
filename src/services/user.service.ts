import { eq, and, desc, count, gte, or, ilike } from 'drizzle-orm';
import { db } from '@/db/connection';
import { user } from '@/db/schema';
import { BaseService, ServiceResponse, PaginationParams, PaginatedResponse } from './base.service';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateUserData {
  name?: string;
  image?: string;
}

export interface UserStats {
  totalUsers: number;
  verifiedUsers: number;
  recentUsers: number;
  userGrowth: number;
}

/**
 * Service for managing user operations
 */
export class UserService extends BaseService {
  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<ServiceResponse<UserProfile | null>> {
    try {
      this.validateRequired({ userId }, ['userId']);
      this.logOperation('getUserProfile', { userId });

      const userData = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const userProfile = userData[0] || null;

      return this.createResponse(userProfile);
    } catch (error) {
      this.handleError(error, 'Failed to get user profile');
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updateData: UpdateUserData): Promise<ServiceResponse<UserProfile>> {
    try {
      this.validateRequired({ userId }, ['userId']);
      this.logOperation('updateUserProfile', { userId, updateData });

      const sanitizedData = this.sanitizeInput(updateData);

      if (Object.keys(sanitizedData).length === 0) {
        throw new Error('No valid update data provided');
      }

      const updatedUser = await db
        .update(user)
        .set({
          ...sanitizedData,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId))
        .returning();

      if (updatedUser.length === 0) {
        throw new Error('User not found');
      }

      const updatedUserData = updatedUser[0];
      if (!updatedUserData) {
        throw new Error('User not found');
      }

      return this.createResponse(updatedUserData);
    } catch (error) {
      this.handleError(error, 'Failed to update user profile');
    }
  }

  /**
   * Delete user account
   */
  async deleteUserAccount(userId: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ userId }, ['userId']);
      this.logOperation('deleteUserAccount', { userId });

      const deletedUser = await db
        .delete(user)
        .where(eq(user.id, userId))
        .returning();

      if (deletedUser.length === 0) {
        throw new Error('User not found');
      }

      return this.createResponse(true, 'User account deleted successfully');
    } catch (error) {
      this.handleError(error, 'Failed to delete user account');
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<ServiceResponse<UserStats>> {
    try {
      this.logOperation('getUserStats');

      // Get total users count
      const totalUsersResult = await db
        .select({ count: count() })
        .from(user);

      const totalUsers = totalUsersResult[0]?.count || 0;

      // Get verified users count
      const verifiedUsersResult = await db
        .select({ count: count() })
        .from(user)
        .where(eq(user.emailVerified, true));

      const verifiedUsers = verifiedUsersResult[0]?.count || 0;

      // Get recent users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentUsersResult = await db
        .select({ count: count() })
        .from(user)
        .where(gte(user.createdAt, thirtyDaysAgo));

      const recentUsers = recentUsersResult[0]?.count || 0;

      // Calculate growth rate (simplified)
      const userGrowth = totalUsers > 0 ? (recentUsers / totalUsers) * 100 : 0;

      const stats: UserStats = {
        totalUsers,
        verifiedUsers,
        recentUsers,
        userGrowth: Math.round(userGrowth * 100) / 100, // Round to 2 decimal places
      };

      return this.createResponse(stats);
    } catch (error) {
      this.handleError(error, 'Failed to get user statistics');
    }
  }

  /**
   * Get paginated list of users
   */
  async getUsers(params: PaginationParams = {}): Promise<ServiceResponse<PaginatedResponse<UserProfile>>> {
    try {
      const { page = 1, limit = 10 } = params;
      const offset = (page - 1) * limit;

      this.logOperation('getUsers', { page, limit, offset });

      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(user);

      const total = totalResult[0]?.count || 0;

      // Get paginated users
      const users = await db
        .select()
        .from(user)
        .orderBy(desc(user.createdAt))
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(total / limit);

      const paginatedResponse: PaginatedResponse<UserProfile> = {
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      return this.createResponse(paginatedResponse);
    } catch (error) {
      this.handleError(error, 'Failed to get users list');
    }
  }

  /**
   * Search users by email or name
   */
  async searchUsers(query: string, params: PaginationParams = {}): Promise<ServiceResponse<PaginatedResponse<UserProfile>>> {
    try {
      this.validateRequired({ query }, ['query']);
      
      const { page = 1, limit = 10 } = params;
      const offset = (page - 1) * limit;

      this.logOperation('searchUsers', { query, page, limit });

      // For simplicity, we'll use a basic search
      // In production, you might want to use full-text search or a search engine
      const searchPattern = `%${query.toLowerCase()}%`;

      const users = await db
        .select()
        .from(user)
        .where(
          or(
            ilike(user.email, searchPattern),
            ilike(user.name, searchPattern)
          )
        )
        .orderBy(desc(user.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count for search results
      const totalResult = await db
        .select({ count: count() })
        .from(user)
        .where(
          or(
            ilike(user.email, searchPattern),
            ilike(user.name, searchPattern)
          )
        );

      const total = totalResult[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      const paginatedResponse: PaginatedResponse<UserProfile> = {
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      return this.createResponse(paginatedResponse);
    } catch (error) {
      this.handleError(error, 'Failed to search users');
    }
  }
}

// Export singleton instance
export const userService = new UserService();