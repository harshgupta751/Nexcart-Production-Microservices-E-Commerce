import { Request, Response, NextFunction } from 'express';
import { AppError, createLogger } from '@nexcart/shared';

const logger = createLogger('Auth-Service:Error');

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message, errors: err.errors });
    return;
  }
  logger.error('Unhandled error', err);
  res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
}