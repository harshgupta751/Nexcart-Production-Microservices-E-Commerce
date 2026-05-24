import * as amqp from 'amqplib';
import { createLogger } from '@nexcart/shared';

const logger = createLogger('Order-Service:RabbitMQ');

class RabbitMQClient {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private url: string;

  constructor(url: string) { this.url = url; }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange('order.exchange', 'topic', { durable: true });
      await this.channel.assertExchange('payment.exchange', 'topic', { durable: true });

      await this.channel.assertQueue('payment.success.queue', { durable: true });
      await this.channel.assertQueue('payment.failed.queue', { durable: true });
      await this.channel.bindQueue('payment.success.queue', 'payment.exchange', 'payment.success');
      await this.channel.bindQueue('payment.failed.queue', 'payment.exchange', 'payment.failed');

      await this.channel.prefetch(1);

      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error', err);
        this.scheduleReconnect();
      });
      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.scheduleReconnect();
      });

      await this.consumePaymentEvents();
      logger.info('RabbitMQ connected');
    } catch (error) {
      logger.error('RabbitMQ connection failed', error as Error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.connection = null;
    this.channel = null;
    setTimeout(() => this.connect(), 5000);
  }

  async publish(exchange: string, routingKey: string, message: object): Promise<boolean> {
    if (!this.channel) return false;
    try {
      return this.channel.publish(
        exchange, routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, contentType: 'application/json' }
      );
    } catch (err) {
      logger.error('Publish failed', err as Error);
      return false;
    }
  }

  private async consumePaymentEvents(): Promise<void> {
    if (!this.channel) return;
    const channel = this.channel;

    await channel.consume('payment.success.queue', async (msg) => {
      if (!msg) return;
      try {
        const event = JSON.parse(msg.content.toString());
        const { orderId, paymentId } = event.payload;
        const axios = (await import('axios')).default;
        await axios.patch(
          `http://localhost:${process.env.PORT || 3005}/api/orders/${orderId}/status`,
          { status: 'CONFIRMED', paymentIntentId: paymentId }
        );
        channel.ack(msg);
        logger.info('Order confirmed via payment.success', { orderId });
      } catch (err) {
        logger.error('Failed to process payment.success', err as Error);
        channel.nack(msg, false, !msg.fields.redelivered);
      }
    });

    await channel.consume('payment.failed.queue', async (msg) => {
      if (!msg) return;
      try {
        const event = JSON.parse(msg.content.toString());
        const { orderId } = event.payload;
        const axios = (await import('axios')).default;
        await axios.patch(
          `http://localhost:${process.env.PORT || 3005}/api/orders/${orderId}/status`,
          { status: 'CANCELLED' }
        );
        channel.ack(msg);
        logger.info('Order cancelled via payment.failed', { orderId });
      } catch (err) {
        logger.error('Failed to process payment.failed', err as Error);
        channel.nack(msg, false, !msg.fields.redelivered);
      }
    });
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      logger.error('Error closing RabbitMQ', error as Error);
    }
  }
}

export const rabbitMQ = new RabbitMQClient(
  process.env.RABBITMQ_URL || 'amqp://nexcart:nexcart_secret@rabbitmq:5672'
);