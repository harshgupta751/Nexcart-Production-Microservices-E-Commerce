import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createLogger } from '@nexcart/shared';
import { prisma } from './utils/prisma';
import { userRouter } from './routes/user.routes';

const logger = createLogger('User-Service');
const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet()); app.use(cors()); app.use(express.json());

app.get('/health', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'healthy', service: 'user-service' }); }
  catch { res.status(503).json({ status: 'unhealthy' }); }
});

app.use('/api/users', userRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ success: false, message: err.message });
});

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  logger.info('PostgreSQL connected');
  app.listen(PORT, () => logger.info(`User Service on port ${PORT}`));
}

process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
bootstrap().catch((err) => { logger.error('Startup failed', err); process.exit(1); });