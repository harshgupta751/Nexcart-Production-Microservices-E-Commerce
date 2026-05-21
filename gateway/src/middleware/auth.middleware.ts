import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UnauthorizedError, createLogger, CACHE_KEYS } from '@nexcart/shared';
import { redisClient } from '../utils/redis';

const logger = createLogger('API-Gateway:Auth');

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      requestId?: string;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);
    if (!token) throw new UnauthorizedError('Token not provided');

    const isBlacklisted = await redisClient.get(CACHE_KEYS.TOKEN_BLACKLIST(token));
    if (isBlacklisted) throw new UnauthorizedError('Token has been revoked');

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;

    logger.debug('Request authenticated', { userId: decoded.userId, role: decoded.role });
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, message: 'Invalid token' });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token expired' });
    } else if (error instanceof UnauthorizedError) {
      res.status(401).json({ success: false, message: error.message });
    } else {
      logger.error('Auth middleware error', error as Error);
      res.status(500).json({ success: false, message: 'Authentication error' });
    }
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    if (!roles.includes(req.user.role)) { res.status(403).json({ success: false, message: 'Insufficient permissions' }); return; }
    next();
  };
}