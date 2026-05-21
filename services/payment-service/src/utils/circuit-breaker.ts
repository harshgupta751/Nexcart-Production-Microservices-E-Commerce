import CircuitBreaker from 'opossum';
import Stripe from 'stripe';
import { createLogger, ServiceUnavailableError } from '@nexcart/shared';

const logger = createLogger('Payment-Service:CircuitBreaker');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16',
});

async function stripeCreatePaymentIntent(params: Stripe.PaymentIntentCreateParams): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create(params);
}

async function stripeConfirmPaymentIntent(intentId: string, params: Stripe.PaymentIntentConfirmParams): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.confirm(intentId, params);
}

async function stripeCreateRefund(params: Stripe.RefundCreateParams): Promise<Stripe.Refund> {
  return stripe.refunds.create(params);
}

const circuitBreakerOptions: CircuitBreaker.Options = {
  timeout: Number(process.env.CB_TIMEOUT) || 5000,
  errorThresholdPercentage: Number(process.env.CB_ERROR_THRESHOLD) || 50,
  resetTimeout: Number(process.env.CB_RESET_TIMEOUT) || 30000,
  volumeThreshold: 5,
};

const createIntentBreaker = new CircuitBreaker(stripeCreatePaymentIntent, circuitBreakerOptions);
const confirmIntentBreaker = new CircuitBreaker(stripeConfirmPaymentIntent, circuitBreakerOptions);
const createRefundBreaker = new CircuitBreaker(stripeCreateRefund, circuitBreakerOptions);

function attachEvents(breaker: CircuitBreaker, name: string): void {
  breaker.on('open', () => logger.error(`Circuit OPEN — ${name} unavailable`, new Error(`Circuit open: ${name}`)));
  breaker.on('halfOpen', () => logger.warn(`Circuit HALF-OPEN — testing ${name}`));
  breaker.on('close', () => logger.info(`Circuit CLOSED — ${name} recovered`));
  breaker.on('timeout', () => logger.warn(`Circuit TIMEOUT on ${name}`));
  breaker.on('reject', () => logger.warn(`Circuit REJECTED call to ${name}`));
}

attachEvents(createIntentBreaker, 'stripe.createPaymentIntent');
attachEvents(confirmIntentBreaker, 'stripe.confirmPaymentIntent');
attachEvents(createRefundBreaker, 'stripe.createRefund');

createIntentBreaker.fallback(() => { throw new ServiceUnavailableError('Payment processor'); });
confirmIntentBreaker.fallback(() => { throw new ServiceUnavailableError('Payment processor'); });
createRefundBreaker.fallback(() => { throw new ServiceUnavailableError('Refund processor'); });

export const stripeClient = {
  createPaymentIntent: (params: Stripe.PaymentIntentCreateParams) =>
    createIntentBreaker.fire(params) as Promise<Stripe.PaymentIntent>,
  confirmPaymentIntent: (intentId: string, params: Stripe.PaymentIntentConfirmParams) =>
    confirmIntentBreaker.fire(intentId, params) as Promise<Stripe.PaymentIntent>,
  createRefund: (params: Stripe.RefundCreateParams) =>
    createRefundBreaker.fire(params) as Promise<Stripe.Refund>,
  constructWebhookEvent: (payload: string | Buffer, signature: string, secret: string) =>
    stripe.webhooks.constructEvent(payload, signature, secret),
  getCircuitStats: () => ({
    createIntent: {
      state: createIntentBreaker.opened ? 'OPEN' : createIntentBreaker.halfOpen ? 'HALF-OPEN' : 'CLOSED',
      stats: createIntentBreaker.stats,
    },
    confirmIntent: {
      state: confirmIntentBreaker.opened ? 'OPEN' : confirmIntentBreaker.halfOpen ? 'HALF-OPEN' : 'CLOSED',
      stats: confirmIntentBreaker.stats,
    },
  }),
};