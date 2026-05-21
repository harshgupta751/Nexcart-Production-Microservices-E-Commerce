import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { prisma } from '../utils/prisma';
import { rabbitMQ } from '../utils/rabbitmq';
import { successResponse, NotFoundError, ForbiddenError, ValidationError, createLogger, getPaginationParams, buildPagination, EventType } from '@nexcart/shared';

const logger = createLogger('Order-Service:Controller');
const TAX_RATE = Number(process.env.TAX_RATE) || 0.08;
const SHIPPING_COST = Number(process.env.SHIPPING_COST) || 5.99;
const FREE_SHIPPING_THRESHOLD = Number(process.env.FREE_SHIPPING_THRESHOLD) || 50;

export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const userEmail = req.headers['x-user-email'] as string;
    const { items, shippingAddress } = req.body;

    if (!items || items.length === 0) throw new ValidationError([{ message: 'Order must contain at least one item' }]);

    const subtotal = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    const tax = Number((subtotal * TAX_RATE).toFixed(2));
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const total = Number((subtotal + tax + shipping).toFixed(2));

    const order = await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          userId, status: 'PENDING', subtotal, tax, shippingCost: shipping, total,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId, name: item.name,
              price: item.price, quantity: item.quantity, image: item.image,
            })),
          },
          shippingAddress: {
            create: {
              street: shippingAddress.street, city: shippingAddress.city,
              state: shippingAddress.state, country: shippingAddress.country, zipCode: shippingAddress.zipCode,
            },
          },
        },
        include: { items: true, shippingAddress: true },
      });
    });

    await rabbitMQ.publish('order.exchange', 'order.placed', {
      eventId: uuidv4(), eventType: EventType.ORDER_PLACED,
      timestamp: new Date(), version: '1.0',
      payload: {
        orderId: order.id, userId, userEmail,
        items: order.items.map((i) => ({ productId: i.productId, name: i.name, price: Number(i.price), quantity: i.quantity, image: i.image })),
        total: Number(order.total), shippingAddress: order.shippingAddress,
      },
    });

    clearUserCart(userId).catch((err) => logger.warn('Failed to clear cart after order', { userId, err }));

    logger.info('Order created', { orderId: order.id, userId, total });
    res.status(201).json(successResponse(order, 'Order placed successfully'));
  } catch (error) { next(error); }
}

export async function getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { page, limit, skip, take } = getPaginationParams(req.query.page, req.query.limit);
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where: { userId }, include: { items: true, shippingAddress: true }, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.order.count({ where: { userId } }),
    ]);
    res.json(successResponse(orders, undefined, buildPagination(total, page, take)));
  } catch (error) { next(error); }
}

export async function getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true, shippingAddress: true } });
    if (!order) throw new NotFoundError('Order');
    if (order.userId !== userId && userRole !== 'admin') throw new ForbiddenError('Access denied');
    res.json(successResponse(order));
  } catch (error) { next(error); }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundError('Order');
    if (order.userId !== userId) throw new ForbiddenError('Access denied');
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) throw new ValidationError([{ message: 'Order cannot be cancelled at this stage' }]);

    const updated = await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' }, include: { items: true, shippingAddress: true } });

    await rabbitMQ.publish('order.exchange', 'order.cancelled', {
      eventId: uuidv4(), eventType: EventType.ORDER_CANCELLED,
      timestamp: new Date(), version: '1.0', payload: { orderId: id, userId },
    });

    logger.info('Order cancelled', { orderId: id, userId });
    res.json(successResponse(updated, 'Order cancelled'));
  } catch (error) { next(error); }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { status, paymentIntentId } = req.body;
    const order = await prisma.order.update({
      where: { id },
      data: { status: status as any, ...(paymentIntentId && { paymentIntentId }) },
    });
    logger.info('Order status updated', { orderId: id, status });
    res.json(successResponse(order));
  } catch (error) { next(error); }
}

async function clearUserCart(userId: string): Promise<void> {
  const cartUrl = process.env.CART_SERVICE_URL || 'http://cart-service:3004';
  await axios.delete(`${cartUrl}/api/cart`, { headers: { 'x-user-id': userId } });
}