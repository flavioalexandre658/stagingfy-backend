import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisPassword = process.env.REDIS_PASSWORD;

const redisOptions: any = {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableReadyCheck: false,
};

if (redisPassword) {
  redisOptions.password = redisPassword;
}

export const redis = new Redis(redisUrl, redisOptions);

redis.on('connect', async () => {
  logger.info('Redis connected successfully');
  
  try {
    // Verificar e configurar política de eviction
    const currentPolicy = await redis.config('GET', 'maxmemory-policy') as string[];
    const policy = currentPolicy[1];
    
    if (policy !== 'noeviction') {
      logger.warn(`Redis eviction policy is '${policy}', changing to 'noeviction'`);
      await redis.config('SET', 'maxmemory-policy', 'noeviction');
      logger.info('Redis eviction policy changed to noeviction');
    } else {
      logger.info('Redis eviction policy is already set to noeviction');
    }
  } catch (error) {
    logger.error('Failed to configure Redis eviction policy:', error as Error);
  }
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

export default redis;