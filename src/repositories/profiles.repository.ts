import { eq, desc } from 'drizzle-orm';
import { profiles } from '@/db/schema/profiles';
import { db } from '@/db/connection';
import { v4 as uuidv4 } from 'uuid';
import { logService } from '@/services/log.service';

export interface ProfileEntity {
  id: string;
  userId: string;
  name: string;
  role: 'user' | 'admin';
  credits: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProfileData {
  userId: string;
  name: string;
  role?: 'user' | 'admin';
  credits?: number;
}

export interface UpdateProfileData {
  name?: string;
  role?: 'user' | 'admin';
  credits?: number;
}

export class ProfilesRepository {
  private generateId(): string {
    return uuidv4();
  }

  private async handleError(operation: string, error: unknown): Promise<never> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorObj = error instanceof Error ? error : new Error(errorMessage);
    
    await logService.error(`ProfileRepository.${operation} failed`, errorObj, {
      operation,
      timestamp: new Date().toISOString()
    });
    

    
    throw new Error(`Failed to ${operation}: ${errorMessage}`);
  }

  async findById(id: string): Promise<ProfileEntity | null> {
    try {
      const result = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      this.handleError('findById', error);
      return null;
    }
  }

  async findByUserId(userId: string): Promise<ProfileEntity | null> {
    try {
      const result = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
      return result[0] || null;
    } catch (error) {
      this.handleError('findByUserId', error);
      return null;
    }
  }

  async create(data: CreateProfileData): Promise<ProfileEntity | null> {
    try {
      const profileData = {
        userId: data.userId,
        name: data.name,
        role: data.role || ('user' as const),
        credits: data.credits || 0,
      };

      const result = await db.insert(profiles).values(profileData).returning();
      return result[0] || null;
    } catch (error) {
      this.handleError('create', error);
      return null;
    }
  }

  async update(id: string, data: UpdateProfileData): Promise<ProfileEntity | null> {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date(),
      };

      const result = await db
        .update(profiles)
        .set(updateData)
        .where(eq(profiles.id, id))
        .returning();

      return result[0] || null;
    } catch (error) {
      this.handleError('update', error);
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await db.delete(profiles).where(eq(profiles.id, id));
      return result.rowCount > 0;
    } catch (error) {
      this.handleError('delete', error);
      return false;
    }
  }

  async updateCredits(id: string, credits: number): Promise<ProfileEntity | null> {
    try {
      const result = await db
        .update(profiles)
        .set({ 
          credits,
          updatedAt: new Date()
        })
        .where(eq(profiles.id, id))
        .returning();

      return result[0] || null;
    } catch (error) {
      this.handleError('updateCredits', error);
      return null;
    }
  }

  async addCredits(id: string, amount: number): Promise<ProfileEntity | null> {
    try {
      const profile = await this.findById(id);
      if (!profile) return null;

      const newCredits = profile.credits + amount;
      return await this.updateCredits(id, newCredits);
    } catch (error) {
      this.handleError('addCredits', error);
      return null;
    }
  }

  async subtractCredits(id: string, amount: number): Promise<ProfileEntity | null> {
    try {
      const profile = await this.findById(id);
      if (!profile) return null;

      const newCredits = Math.max(0, profile.credits - amount);
      return await this.updateCredits(id, newCredits);
    } catch (error) {
      this.handleError('subtractCredits', error);
      return null;
    }
  }

  async findAll(): Promise<ProfileEntity[]> {
    try {
      return await db.select().from(profiles).orderBy(desc(profiles.createdAt));
    } catch (error) {
      return await this.handleError('findAll', error);
    }
  }
}

// Export singleton instance
export const profilesRepository = new ProfilesRepository();