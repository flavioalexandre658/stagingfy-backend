import { BaseService, ServiceResponse } from './base.service';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
  namespace?: string; // Namespace for cache keys
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
}

/**
 * Service for caching data with support for TTL, tags, and namespaces
 */
export class CacheService extends BaseService {
  private cache = new Map<string, { value: any; expires: number; tags: string[] }>();
  private stats = { hits: 0, misses: 0 };
  private defaultTTL = 3600; // 1 hour in seconds

  /**
   * Set a value in cache
   */
  async set<T>(
    key: string, 
    value: T, 
    options: CacheOptions = {}
  ): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ key, value }, ['key', 'value']);
      
      const { ttl = this.defaultTTL, tags = [], namespace } = options;
      const fullKey = this.buildKey(key, namespace);
      const expires = Date.now() + (ttl * 1000);

      this.cache.set(fullKey, {
        value: JSON.parse(JSON.stringify(value)), // Deep clone
        expires,
        tags,
      });

      this.logOperation('set', { key: fullKey, ttl, tags });

      return this.createResponse(true, 'Value cached successfully');
    } catch (error) {
      this.handleError(error, 'Failed to set cache value');
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, namespace?: string): Promise<ServiceResponse<T | null>> {
    try {
      this.validateRequired({ key }, ['key']);
      
      const fullKey = this.buildKey(key, namespace);
      const cached = this.cache.get(fullKey);

      if (!cached) {
        this.stats.misses++;
        this.logOperation('get', { key: fullKey, hit: false });
        return this.createResponse(null);
      }

      // Check if expired
      if (Date.now() > cached.expires) {
        this.cache.delete(fullKey);
        this.stats.misses++;
        this.logOperation('get', { key: fullKey, hit: false, reason: 'expired' });
        return this.createResponse(null);
      }

      this.stats.hits++;
      this.logOperation('get', { key: fullKey, hit: true });
      
      return this.createResponse(cached.value as T);
    } catch (error) {
      this.handleError(error, 'Failed to get cache value');
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string, namespace?: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ key }, ['key']);
      
      const fullKey = this.buildKey(key, namespace);
      const deleted = this.cache.delete(fullKey);

      this.logOperation('delete', { key: fullKey, deleted });

      return this.createResponse(deleted, deleted ? 'Value deleted from cache' : 'Value not found in cache');
    } catch (error) {
      this.handleError(error, 'Failed to delete cache value');
    }
  }

  /**
   * Check if a key exists in cache
   */
  async has(key: string, namespace?: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ key }, ['key']);
      
      const fullKey = this.buildKey(key, namespace);
      const cached = this.cache.get(fullKey);

      if (!cached) {
        return this.createResponse(false);
      }

      // Check if expired
      if (Date.now() > cached.expires) {
        this.cache.delete(fullKey);
        return this.createResponse(false);
      }

      return this.createResponse(true);
    } catch (error) {
      this.handleError(error, 'Failed to check cache key');
    }
  }

  /**
   * Get or set a value in cache
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options: CacheOptions = {}
  ): Promise<ServiceResponse<T>> {
    try {
      this.validateRequired({ key, factory }, ['key', 'factory']);
      
      const { namespace } = options;
      const cached = await this.get<T>(key, namespace);

      if (cached.data !== null) {
        return this.createResponse(cached.data);
      }

      // Value not in cache, generate it
      const value = await factory();
      await this.set(key, value, options);

      this.logOperation('getOrSet', { key: this.buildKey(key, namespace), generated: true });

      return this.createResponse(value);
    } catch (error) {
      this.handleError(error, 'Failed to get or set cache value');
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<ServiceResponse<number>> {
    try {
      this.validateRequired({ tags }, ['tags']);
      
      let deletedCount = 0;

      for (const [key, cached] of this.cache.entries()) {
        const hasMatchingTag = tags.some(tag => cached.tags.includes(tag));
        if (hasMatchingTag) {
          this.cache.delete(key);
          deletedCount++;
        }
      }

      this.logOperation('invalidateByTags', { tags, deletedCount });

      return this.createResponse(deletedCount, `Invalidated ${deletedCount} cache entries`);
    } catch (error) {
      this.handleError(error, 'Failed to invalidate cache by tags');
    }
  }

  /**
   * Invalidate cache by namespace
   */
  async invalidateByNamespace(namespace: string): Promise<ServiceResponse<number>> {
    try {
      this.validateRequired({ namespace }, ['namespace']);
      
      let deletedCount = 0;
      const prefix = `${namespace}:`;

      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          deletedCount++;
        }
      }

      this.logOperation('invalidateByNamespace', { namespace, deletedCount });

      return this.createResponse(deletedCount, `Invalidated ${deletedCount} cache entries`);
    } catch (error) {
      this.handleError(error, 'Failed to invalidate cache by namespace');
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<ServiceResponse<boolean>> {
    try {
      const size = this.cache.size;
      this.cache.clear();
      this.stats = { hits: 0, misses: 0 };

      this.logOperation('clear', { clearedEntries: size });

      return this.createResponse(true, `Cleared ${size} cache entries`);
    } catch (error) {
      this.handleError(error, 'Failed to clear cache');
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<ServiceResponse<CacheStats>> {
    try {
      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

      // Calculate memory usage (approximate)
      let memoryUsage = 0;
      for (const [key, cached] of this.cache.entries()) {
        memoryUsage += key.length * 2; // String characters are 2 bytes
        memoryUsage += JSON.stringify(cached.value).length * 2;
        memoryUsage += cached.tags.join('').length * 2;
        memoryUsage += 8; // expires timestamp
      }

      const stats: CacheStats = {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        totalKeys: this.cache.size,
        memoryUsage,
      };

      return this.createResponse(stats);
    } catch (error) {
      this.handleError(error, 'Failed to get cache stats');
    }
  }

  /**
   * Get all cache keys
   */
  async getKeys(namespace?: string): Promise<ServiceResponse<string[]>> {
    try {
      let keys = Array.from(this.cache.keys());

      if (namespace) {
        const prefix = `${namespace}:`;
        keys = keys.filter(key => key.startsWith(prefix));
        // Remove namespace prefix from keys
        keys = keys.map(key => key.substring(prefix.length));
      }

      return this.createResponse(keys);
    } catch (error) {
      this.handleError(error, 'Failed to get cache keys');
    }
  }

  /**
   * Clean expired entries
   */
  async cleanExpired(): Promise<ServiceResponse<number>> {
    try {
      let deletedCount = 0;
      const now = Date.now();

      for (const [key, cached] of this.cache.entries()) {
        if (now > cached.expires) {
          this.cache.delete(key);
          deletedCount++;
        }
      }

      this.logOperation('cleanExpired', { deletedCount });

      return this.createResponse(deletedCount, `Cleaned ${deletedCount} expired entries`);
    } catch (error) {
      this.handleError(error, 'Failed to clean expired entries');
    }
  }

  /**
   * Set multiple values at once
   */
  async setMany<T>(
    entries: Array<{ key: string; value: T; options?: CacheOptions }>,
    globalOptions: CacheOptions = {}
  ): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ entries }, ['entries']);
      
      for (const entry of entries) {
        const options = { ...globalOptions, ...entry.options };
        await this.set(entry.key, entry.value, options);
      }

      this.logOperation('setMany', { count: entries.length });

      return this.createResponse(true, `Set ${entries.length} cache entries`);
    } catch (error) {
      this.handleError(error, 'Failed to set multiple cache values');
    }
  }

  /**
   * Get multiple values at once
   */
  async getMany<T>(keys: string[], namespace?: string): Promise<ServiceResponse<Record<string, T | null>>> {
    try {
      this.validateRequired({ keys }, ['keys']);
      
      const result: Record<string, T | null> = {};

      for (const key of keys) {
        const cached = await this.get<T>(key, namespace);
        result[key] = cached.data;
      }

      this.logOperation('getMany', { count: keys.length });

      return this.createResponse(result);
    } catch (error) {
      this.handleError(error, 'Failed to get multiple cache values');
    }
  }

  /**
   * Build full cache key with namespace
   */
  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  /**
   * Start automatic cleanup of expired entries
   */
  startCleanupInterval(intervalMs: number = 300000): void { // 5 minutes default
    setInterval(async () => {
      await this.cleanExpired();
    }, intervalMs);

    this.logger.info('Cache cleanup interval started', { intervalMs });
  }
}

// Export singleton instance
export const cacheService = new CacheService();