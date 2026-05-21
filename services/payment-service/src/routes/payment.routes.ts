import { Router } from 'express';
import express from 'express';
import { createPaymentIntent, handleWebhook, confirmPayment, getPaymentByOrder, refundPayment, getCircuitStatus } from '../controllers/payment.controller';

export const paymentRouter = Router();

paymentRouter.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);
paymentRouter.get('/circuit-status', getCircuitStatus);
paymentRouter.post('/intent', createPaymentIntent);
paymentRouter.post('/confirm', confirmPayment);
paymentRouter.get('/order/:orderId', getPaymentByOrder);
paymentRouter.post('/:paymentId/refund', refundPayment);