import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../utils/redis';
import { createLogger } from '@nexcart/shared';

const logger = createLogger('API-Gateway:RateLimit');

export const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args as [string, ...string[]]),
    prefix: 'rl:general:',
  }),
  keyGenerator: (req) => req.user?.userId || req.ip || 'unknown',
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, userId: req.user?.userId, path: req.path });
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args as [string, ...string[]]),
    prefix: 'rl:auth:',
  }),
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (_req, res) => {
    res.status(429).json({ success: false, message: 'Too many authentication attempts. Please try again in a minute.' });
  },
});

export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args as [string, ...string[]]),
    prefix: 'rl:payment:',
  }),
  keyGenerator: (req) => req.user?.userId || req.ip || 'unknown',
  handler: (_req, res) => {
    res.status(429).json({ success: false, message: 'Payment rate limit exceeded. Please wait before trying again.' });
  },
});