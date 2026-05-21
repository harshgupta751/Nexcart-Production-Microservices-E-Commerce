import Redis from 'ioredis';
import { createLogger } from '@nexcart/shared';

const logger = createLogger('API-Gateway:Redis');

export const redisClient = new Redis(process.env.REDIS_URL || 'redis://:nexcart_secret@redis:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
});

redisClient.on('connect', () => logger.info('Redis connected'));
redisClient.on('error', (err) => logger.error('Redis error', err));
redisClient.on('close', () => logger.warn('Redis connection closed'));