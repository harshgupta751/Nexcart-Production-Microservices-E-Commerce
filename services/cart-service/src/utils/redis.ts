import Redis from 'ioredis';
import { createLogger } from '@nexcart/shared';

const logger = createLogger('Cart-Service:Redis');

export const redisClient = new Redis(process.env.REDIS_URL || 'redis://:nexcart_secret@redis:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redisClient.on('connect', () => logger.info('Redis connected'));
redisClient.on('error', (err) => logger.error('Redis error', err));