import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createLogger } from '@nexcart/shared';
import { prisma } from './utils/prisma';
import { redisClient } from './utils/redis';
import { rabbitMQ } from './utils/rabbitmq';
import { authRouter } from './routes/auth.routes';
import { errorHandler } from './middleware/error.middleware';

const logger = createLogger('Auth-Service');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redisClient.ping();
    res.json({ status: 'healthy', service: 'auth-service', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', service: 'auth-service' });
  }
});

app.use('/api/auth', authRouter);
app.use(errorHandler);

async function bootstrap(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL connected');
    await redisClient.ping();
    logger.info('Redis connected');
    await rabbitMQ.connect();
    logger.info('RabbitMQ connected');
    app.listen(PORT, () => logger.info(`Auth Service running on port ${PORT}`));
  } catch (error) {
    logger.error('Failed to start Auth Service', error as Error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  await redisClient.quit();
  await rabbitMQ.close();
  process.exit(0);
});

bootstrap();