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

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

export default redis;