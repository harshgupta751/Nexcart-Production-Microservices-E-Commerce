import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';
import { redisClient } from '../utils/redis';
import { rabbitMQ } from '../utils/rabbitmq';
import {
  successResponse, ConflictError, UnauthorizedError, NotFoundError,
  createLogger, JwtPayload, UserRole, EventType, CACHE_KEYS, CACHE_TTL,
} from '@nexcart/shared';

const logger = createLogger('Auth-Service:Controller');
const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions);
  const refreshToken = jwt.sign({ userId: payload.userId }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, name } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictError('Email already registered');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({ data: { email, passwordHash, role: 'CUSTOMER' } });

    const payload: JwtPayload = { userId: user.id, email: user.email, role: UserRole.CUSTOMER };
    const { accessToken, refreshToken } = generateTokens(payload);

    await redisClient.setex(CACHE_KEYS.REFRESH_TOKEN(user.id), CACHE_TTL.REFRESH_TOKEN, refreshToken);

    await rabbitMQ.publish('user.exchange', 'user.registered', {
      eventId: uuidv4(), eventType: EventType.USER_REGISTERED,
      timestamp: new Date(), version: '1.0',
      payload: { userId: user.id, email: user.email, name },
    });

    logger.info('User registered', { userId: user.id });
    res.status(201).json(successResponse(
      { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } },
      'Registration successful'
    ));
  } catch (error) { next(error); }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedError('Invalid email or password');

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('Invalid email or password');

    const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role.toLowerCase() as UserRole };
    const { accessToken, refreshToken } = generateTokens(payload);

    await redisClient.setex(CACHE_KEYS.REFRESH_TOKEN(user.id), CACHE_TTL.REFRESH_TOKEN, refreshToken);

    logger.info('User logged in', { userId: user.id });
    res.json(successResponse(
      { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } },
      'Login successful'
    ));
  } catch (error) { next(error); }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new UnauthorizedError('Refresh token required');

    const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
    const stored = await redisClient.get(CACHE_KEYS.REFRESH_TOKEN(decoded.userId));
    if (!stored || stored !== refreshToken) throw new UnauthorizedError('Invalid or expired refresh token');

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) throw new UnauthorizedError('User not found');

    const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role.toLowerCase() as UserRole };
    const tokens = generateTokens(payload);

    await redisClient.setex(CACHE_KEYS.REFRESH_TOKEN(user.id), CACHE_TTL.REFRESH_TOKEN, tokens.refreshToken);
    res.json(successResponse(tokens, 'Tokens refreshed'));
  } catch (error) { next(error); }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7);
    const userId = req.headers['x-user-id'] as string;

    if (token) {
      const decoded = jwt.decode(token) as JwtPayload;
      const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : CACHE_TTL.ACCESS_TOKEN;
      if (ttl > 0) await redisClient.setex(CACHE_KEYS.TOKEN_BLACKLIST(token), ttl, '1');
    }
    if (userId) await redisClient.del(CACHE_KEYS.REFRESH_TOKEN(userId));

    res.json(successResponse(null, 'Logged out successfully'));
  } catch (error) { next(error); }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) throw new UnauthorizedError();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isVerified: true, createdAt: true },
    });
    if (!user) throw new NotFoundError('User');
    res.json(successResponse(user));
  } catch (error) { next(error); }
}