import { Request, Response, NextFunction } from 'express';
import { AppError, createLogger } from '@nexcart/shared';

const logger = createLogger('API-Gateway:Error');

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn('Operational error', { message: err.message, statusCode: err.statusCode });
    res.status(err.statusCode).json({ success: false, message: err.message, errors: err.errors });
    return;
  }
  logger.error('Unhandled error', err, { path: req.path, method: req.method });
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}