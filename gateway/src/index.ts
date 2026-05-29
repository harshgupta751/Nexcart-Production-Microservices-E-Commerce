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

const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3000',
  'https://nexcart-production-microservices-e.vercel.app',        // apna Vercel URL
  'https://nexcart-*.vercel.app',       // preview deployments
  process.env.FRONTEND_URL || '',       // env se bhi lo
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowed === origin;
    })) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-user-id',
    'x-user-email',
    'x-user-role',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400, // 24 hours preflight cache
}));

// Handle preflight
app.options('*', cors());

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
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