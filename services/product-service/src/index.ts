import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { createLogger } from '@nexcart/shared';
import { redisClient } from './utils/redis';
import { productRouter } from './routes/product.routes';

const logger = createLogger('Product-Service');
const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet()); app.use(cors()); app.use(express.json());

app.get('/health', async (_req, res) => {
  const mongoState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'healthy', service: 'product-service', mongo: mongoState });
});

app.use('/api/products', productRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ success: false, message: err.message });
});

async function bootstrap(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URL || 'mongodb://nexcart:nexcart_secret@mongo:27017/product_db?authSource=admin');
  logger.info('MongoDB connected');
  await redisClient.ping();
  logger.info('Redis connected');
  app.listen(PORT, () => logger.info(`Product Service on port ${PORT}`));
}

process.on('SIGTERM', async () => { await mongoose.disconnect(); await redisClient.quit(); process.exit(0); });
bootstrap().catch((err) => { logger.error('Startup failed', err); process.exit(1); });