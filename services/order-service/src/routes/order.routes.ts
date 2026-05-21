import { Router } from 'express';
import { body } from 'express-validator';
import { createOrder, getOrders, getOrder, cancelOrder, updateOrderStatus } from '../controllers/order.controller';
import { validate } from '../middleware/validate.middleware';

export const orderRouter = Router();

orderRouter.get('/', getOrders);
orderRouter.get('/:id', getOrder);
orderRouter.post('/', [
  body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
  body('items.*.productId').notEmpty().withMessage('Product ID required'),
  body('items.*.price').isFloat({ min: 0 }).withMessage('Valid price required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('shippingAddress.street').notEmpty(),
  body('shippingAddress.city').notEmpty(),
  body('shippingAddress.country').notEmpty(),
  body('shippingAddress.zipCode').notEmpty(),
], validate, createOrder);
orderRouter.patch('/:id/cancel', cancelOrder);
orderRouter.patch('/:id/status', updateOrderStatus);