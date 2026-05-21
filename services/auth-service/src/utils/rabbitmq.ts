import * as amqp from 'amqplib';
import { createLogger } from '@nexcart/shared';

const logger = createLogger('Auth-Service:RabbitMQ');

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
      await this.channel.assertExchange('notification.exchange', 'topic', { durable: true });
      await this.channel.assertExchange('user.exchange', 'topic', { durable: true });

      const queueOptions = {
        durable: true,
        arguments: { 'x-dead-letter-exchange': 'dlq.exchange', 'x-message-ttl': 86400000 },
      };

      await this.channel.assertQueue('order.placed.queue', queueOptions);
      await this.channel.assertQueue('payment.process.queue', queueOptions);
      await this.channel.assertQueue('payment.success.queue', queueOptions);
      await this.channel.assertQueue('payment.failed.queue', queueOptions);
      await this.channel.assertQueue('notification.email.queue', queueOptions);

      await this.channel.bindQueue('order.placed.queue', 'order.exchange', 'order.placed');
      await this.channel.bindQueue('payment.process.queue', 'order.exchange', 'order.placed');
      await this.channel.bindQueue('payment.success.queue', 'payment.exchange', 'payment.success');
      await this.channel.bindQueue('payment.failed.queue', 'payment.exchange', 'payment.failed');
      await this.channel.bindQueue('notification.email.queue', 'notification.exchange', 'notify.*');
      await this.channel.bindQueue('notification.email.queue', 'payment.exchange', 'payment.*');
      await this.channel.bindQueue('notification.email.queue', 'user.exchange', 'user.*');

      await this.channel.prefetch(1);

      this.connection.on('error', () => this.reconnect());
      this.connection.on('close', () => this.reconnect());

      logger.info('RabbitMQ connected and configured');
    } catch (error) {
      logger.error('RabbitMQ connection failed', error as Error);
      await this.reconnect();
    }
  }

  private async reconnect(): Promise<void> {
    this.connection = null;
    this.channel = null;
    await new Promise((r) => setTimeout(r, 5000));
    await this.connect();
  }

  async publish(exchange: string, routingKey: string, message: object): Promise<boolean> {
    if (!this.channel) {
      logger.error('Cannot publish: channel not available');
      return false;
    }
    try {
      return this.channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, contentType: 'application/json', timestamp: Date.now() }
      );
    } catch (error) {
      logger.error('Failed to publish message', error as Error, { exchange, routingKey });
      return false;
    }
  }

  async consume(queue: string, handler: (message: object) => Promise<void>): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQ channel not available');
    const channel = this.channel;

    await channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        channel.ack(msg);
      } catch (error) {
        logger.error('Message processing failed', error as Error);
        channel.nack(msg, false, !msg.fields.redelivered);
      }
    });

    logger.info(`Consumer registered for queue: ${queue}`);
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