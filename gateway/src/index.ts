import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { createLogger } from '@nexcart/shared';
import { redisClient } from './utils/redis';
import { authMiddleware } from './middleware/auth.middleware';
import { rateLimiter, strictRateLimiter } from './middleware/rate-limit.middleware';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/request-logger.middleware';
import { setupProxyRoutes } from './routes';

const logger = createLogger('API-Gateway');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));
app.use(morgan('combined'));
app.use(requestLogger);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api', rateLimiter);
app.use('/api/auth/login', strictRateLimiter);
app.use('/api/auth/register', strictRateLimiter);

setupProxyRoutes(app, authMiddleware);
app.use(errorHandler);

async function bootstrap(): Promise<void> {
  try {
    await redisClient.ping();
    logger.info('Redis connected successfully');
    app.listen(PORT, () => {
      logger.info(`API Gateway running on port ${PORT}`, { environment: process.env.NODE_ENV });
    });
  } catch (error) {
    logger.error('Failed to start API Gateway', error as Error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason as Error);
});

bootstrap();
export { app };