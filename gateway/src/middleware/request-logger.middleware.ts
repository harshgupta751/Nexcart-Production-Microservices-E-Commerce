import { Request, Response, NextFunction } from 'express';
import { createLogger, generateId } from '@nexcart/shared';

const logger = createLogger('API-Gateway:Request');

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || generateId();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();
  res.on('finish', () => {
    logger.info('Request completed', {
      requestId, method: req.method, path: req.path,
      status: res.statusCode, duration: `${Date.now() - start}ms`,
      userId: req.user?.userId, ip: req.ip,
    });
  });
  next();
}