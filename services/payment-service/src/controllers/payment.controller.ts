import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';
import { stripeClient } from '../utils/circuit-breaker';
import { rabbitMQ } from '../utils/rabbitmq';
import { successResponse, NotFoundError, ValidationError, createLogger, EventType } from '@nexcart/shared';

const logger = createLogger('Payment-Service:Controller');

export async function createPaymentIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { orderId, amount, currency = 'usd' } = req.body;
    if (!orderId || !amount) throw new ValidationError([{ message: 'orderId and amount are required' }]);

    const paymentIntent = await stripeClient.createPaymentIntent({
      amount: Math.round(amount * 100),
      currency,
      metadata: { orderId, userId },
      automatic_payment_methods: { enabled: true },
    });

    const payment = await prisma.payment.create({
      data: { orderId, userId, amount, currency, status: 'PENDING', stripePaymentIntentId: paymentIntent.id, metadata: { clientSecret: paymentIntent.client_secret } },
    });

    logger.info('PaymentIntent created', { paymentId: payment.id, orderId, amount });
    res.status(201).json(successResponse({
      paymentId: payment.id, clientSecret: paymentIntent.client_secret,
      stripePaymentIntentId: paymentIntent.id,
    }, 'Payment intent created'));
  } catch (error) { next(error); }
}

export async function handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  const signature = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  let event;
  try {
    event = stripeClient.constructWebhookEvent(req.body, signature, webhookSecret);
  } catch (err) {
    logger.warn('Webhook signature verification failed');
    res.status(400).json({ error: 'Invalid webhook signature' }); return;
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': await handlePaymentSuccess(event.data.object as any); break;
      case 'payment_intent.payment_failed': await handlePaymentFailure(event.data.object as any); break;
      default: logger.debug('Unhandled webhook event', { type: event.type });
    }
    res.json({ received: true });
  } catch (error) { next(error); }
}

export async function confirmPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { paymentIntentId, paymentMethodId } = req.body;
    const intent = await stripeClient.confirmPaymentIntent(paymentIntentId, { payment_method: paymentMethodId });
    if (intent.status === 'succeeded') { await handlePaymentSuccess(intent); res.json(successResponse({ status: 'success' }, 'Payment confirmed')); }
    else res.json(successResponse({ status: intent.status }, 'Payment pending'));
  } catch (error) { next(error); }
}

export async function getPaymentByOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId } = req.params;
    const payment = await prisma.payment.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
    if (!payment) throw new NotFoundError('Payment');
    res.json(successResponse(payment));
  } catch (error) { next(error); }
}

export async function refundPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { paymentId } = req.params;
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError('Payment');
    if (payment.status !== 'SUCCESS') throw new ValidationError([{ message: 'Only successful payments can be refunded' }]);

    const refund = await stripeClient.createRefund({ payment_intent: payment.stripePaymentIntentId });
    const updated = await prisma.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED', refundId: refund.id } });

    await rabbitMQ.publish('payment.exchange', 'payment.refunded', {
      eventId: uuidv4(), eventType: EventType.PAYMENT_REFUNDED,
      timestamp: new Date(), version: '1.0',
      payload: { paymentId, orderId: payment.orderId, userId: payment.userId },
    });

    logger.info('Payment refunded', { paymentId, orderId: payment.orderId });
    res.json(successResponse(updated, 'Refund processed'));
  } catch (error) { next(error); }
}

export async function getCircuitStatus(_req: Request, res: Response): Promise<void> {
  res.json(successResponse(stripeClient.getCircuitStats(), 'Circuit breaker status'));
}

async function handlePaymentSuccess(intent: any): Promise<void> {
  const { orderId, userId } = intent.metadata;
  await prisma.payment.updateMany({ where: { stripePaymentIntentId: intent.id }, data: { status: 'SUCCESS', stripeChargeId: intent.latest_charge } });
  const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: intent.id } });

  await rabbitMQ.publish('payment.exchange', 'payment.success', {
    eventId: uuidv4(), eventType: EventType.PAYMENT_SUCCESS, timestamp: new Date(), version: '1.0',
    payload: { orderId, userId, userEmail: intent.receipt_email || '', amount: intent.amount / 100, paymentId: payment?.id },
  });
  await rabbitMQ.publish('notification.exchange', 'notify.payment', {
    eventId: uuidv4(), eventType: EventType.PAYMENT_SUCCESS, timestamp: new Date(), version: '1.0',
    payload: { orderId, userId, amount: intent.amount / 100 },
  });
  logger.info('Payment success processed', { orderId });
}

async function handlePaymentFailure(intent: any): Promise<void> {
  const { orderId, userId } = intent.metadata || {};
  await prisma.payment.updateMany({ where: { stripePaymentIntentId: intent.id }, data: { status: 'FAILED', failureReason: intent.last_payment_error?.message || 'Unknown error' } });
  await rabbitMQ.publish('payment.exchange', 'payment.failed', {
    eventId: uuidv4(), eventType: EventType.PAYMENT_FAILED, timestamp: new Date(), version: '1.0',
    payload: { orderId, userId, userEmail: '', reason: intent.last_payment_error?.message || 'Payment failed' },
  });
  logger.warn('Payment failure processed', { orderId });
}