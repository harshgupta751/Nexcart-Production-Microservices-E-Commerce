import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createLogger } from '@nexcart/shared';
import { prisma } from './utils/prisma';
import { rabbitMQ } from './utils/rabbitmq';
import { orderRouter } from './routes/order.routes';

const logger = createLogger('Order-Service');
const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet()); app.use(cors()); app.use(express.json());

app.get('/health', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'healthy', service: 'order-service' }); }
  catch { res.status(503).json({ status: 'unhealthy' }); }
});

app.use('/api/orders', orderRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ success: false, message: err.message });
});

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  logger.info('PostgreSQL connected');
  await rabbitMQ.connect();
  logger.info('RabbitMQ connected');
  app.listen(PORT, () => logger.info(`Order Service on port ${PORT}`));
}

process.on('SIGTERM', async () => { await prisma.$disconnect(); await rabbitMQ.close(); process.exit(0); });
bootstrap().catch((err) => { logger.error('Startup failed', err); process.exit(1); });