import 'dotenv/config';
import express from 'express';
import { createLogger } from '@nexcart/shared';
import { notificationConsumer } from './consumers/notification.consumer';

const logger = createLogger('Notification-Service');
const app = express();
const PORT = process.env.PORT || 3007;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'notification-service' }));

async function bootstrap(): Promise<void> {
  await notificationConsumer.connect();
  logger.info('Notification consumer connected to RabbitMQ');
  app.listen(PORT, () => logger.info(`Notification Service on port ${PORT}`));
}

process.on('SIGTERM', async () => { await notificationConsumer.close(); process.exit(0); });
bootstrap().catch((err) => { logger.error('Startup failed', err); process.exit(1); });