import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createLogger } from '@nexcart/shared';
import { prisma } from './utils/prisma';
import { rabbitMQ } from './utils/rabbitmq';
import { paymentRouter } from './routes/payment.routes';

const logger = createLogger('Payment-Service');
const app = express();
const PORT = process.env.PORT || 3006;

app.use(helmet()); app.use(cors());
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.get('/health', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'healthy', service: 'payment-service' }); }
  catch { res.status(503).json({ status: 'unhealthy' }); }
});

app.use('/api/payments', paymentRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status((err as any).statusCode || 500).json({ success: false, message: err.message });
});

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  logger.info('PostgreSQL connected');
  await rabbitMQ.connect();

  await rabbitMQ.consume('order.placed.queue', async (event: any) => {
    logger.info('Order received for payment processing', { orderId: event.payload?.orderId, total: event.payload?.total });
  });

  app.listen(PORT, () => logger.info(`Payment Service on port ${PORT}`));
}

process.on('SIGTERM', async () => { await prisma.$disconnect(); await rabbitMQ.close(); process.exit(0); });
bootstrap().catch((err) => { logger.error('Startup failed', err); process.exit(1); });