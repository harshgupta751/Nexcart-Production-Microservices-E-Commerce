import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.middleware';
import { register, login, refresh, logout, getMe } from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
], validate, register);

authRouter.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
], validate, login);

authRouter.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token required'),
], validate, refresh);

authRouter.post('/logout', logout);
authRouter.get('/me', getMe);