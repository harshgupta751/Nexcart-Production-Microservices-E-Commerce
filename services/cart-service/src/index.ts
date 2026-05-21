import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createLogger } from '@nexcart/shared';
import { redisClient } from './utils/redis';
import { cartRouter } from './routes/cart.routes';

const logger = createLogger('Cart-Service');
const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet()); app.use(cors()); app.use(express.json());

app.get('/health', async (_req, res) => {
  try { await redisClient.ping(); res.json({ status: 'healthy', service: 'cart-service' }); }
  catch { res.status(503).json({ status: 'unhealthy' }); }
});

app.use('/api/cart', cartRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ success: false, message: err.message });
});

async function bootstrap(): Promise<void> {
  await redisClient.ping();
  logger.info('Redis connected');
  app.listen(PORT, () => logger.info(`Cart Service on port ${PORT}`));
}

bootstrap().catch((err) => { logger.error('Startup failed', err); process.exit(1); });