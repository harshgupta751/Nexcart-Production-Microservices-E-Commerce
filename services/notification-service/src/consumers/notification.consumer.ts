import * as amqp from 'amqplib';
import { createLogger, EventType } from '@nexcart/shared';
import {
  sendEmail,
  orderPlacedTemplate,
  orderConfirmedTemplate,
  paymentFailedTemplate,
  welcomeTemplate,
} from '../utils/email';

const logger = createLogger('Notification-Service:Consumer');

class NotificationConsumer {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private url: string;

  constructor(url: string) { this.url = url; }

async connect(): Promise<void> {
  try {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange('notification.exchange', 'topic', { durable: true });
    await this.channel.assertExchange('payment.exchange', 'topic', { durable: true });
    await this.channel.assertExchange('order.exchange', 'topic', { durable: true });
    await this.channel.assertExchange('user.exchange', 'topic', { durable: true });

    await this.channel.assertQueue('notification.email.queue', { durable: true });

    await this.channel.bindQueue('notification.email.queue', 'notification.exchange', 'notify.*');
    await this.channel.bindQueue('notification.email.queue', 'payment.exchange', 'payment.*');
    await this.channel.bindQueue('notification.email.queue', 'order.exchange', 'order.placed');
    await this.channel.bindQueue('notification.email.queue', 'user.exchange', 'user.registered');

    await this.channel.prefetch(5);

    this.connection.on('error', (err) => {
      logger.error('RabbitMQ error', err);
      this.scheduleReconnect();
    });
    this.connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      this.scheduleReconnect();
    });

    await this.startConsuming();
    logger.info('Notification consumer started');
  } catch (err) {
    logger.error('Failed to connect', err as Error);
    this.scheduleReconnect();
  }
}

private scheduleReconnect(): void {
  this.connection = null;
  this.channel = null;
  setTimeout(() => this.connect(), 5000);
}

  private async reconnect(): Promise<void> {
    this.connection = null;
    this.channel = null;
    await new Promise((r) => setTimeout(r, 5000));
    await this.connect();
  }

  private async startConsuming(): Promise<void> {
    if (!this.channel) return;
    const channel = this.channel;

    await channel.consume('notification.email.queue', async (msg) => {
      if (!msg) return;
      try {
        const event = JSON.parse(msg.content.toString());
        logger.info('Processing notification event', { type: event.eventType, eventId: event.eventId });
        await this.routeEvent(event);
        channel.ack(msg);
      } catch (err) {
        logger.error('Failed to process notification', err as Error);
        channel.nack(msg, false, !msg.fields.redelivered);
      }
    });
  }

  private async routeEvent(event: any): Promise<void> {
    const { eventType, payload } = event;
    switch (eventType) {
      case EventType.ORDER_PLACED:
        await sendEmail(orderPlacedTemplate({
          orderId: payload.orderId, total: payload.total,
          itemCount: payload.items?.length || 0, userEmail: payload.userEmail,
        }));
        break;
      case EventType.PAYMENT_SUCCESS:
        await sendEmail(orderConfirmedTemplate({
          orderId: payload.orderId, total: payload.amount, userEmail: payload.userEmail,
        }));
        break;
      case EventType.PAYMENT_FAILED:
        await sendEmail(paymentFailedTemplate({
          orderId: payload.orderId, reason: payload.reason, userEmail: payload.userEmail,
        }));
        break;
      case EventType.USER_REGISTERED:
        await sendEmail(welcomeTemplate({ name: payload.name, email: payload.email }));
        break;
      default:
        logger.debug('No handler for event type', { eventType });
    }
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}

export const notificationConsumer = new NotificationConsumer(
  process.env.RABBITMQ_URL || 'amqp://nexcart:nexcart_secret@rabbitmq:5672'
);