import * as amqp from 'amqplib';
import { createLogger } from '@nexcart/shared';

const logger = createLogger('Payment-Service:RabbitMQ');

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

      await this.channel.assertQueue('order.placed.queue', { durable: true });
      await this.channel.bindQueue('order.placed.queue', 'order.exchange', 'order.placed');

      await this.channel.prefetch(1);

      this.connection.on('error', () => this.reconnect());
      this.connection.on('close', () => this.reconnect());

      logger.info('RabbitMQ connected');
    } catch (error) {
      logger.error('RabbitMQ connection failed', error as Error);
      setTimeout(() => this.reconnect(), 5000);
    }
  }

  private async reconnect(): Promise<void> {
    this.connection = null;
    this.channel = null;
    await new Promise((r) => setTimeout(r, 5000));
    await this.connect();
  }

  async publish(exchange: string, routingKey: string, message: object): Promise<boolean> {
    if (!this.channel) return false;
    try {
      return this.channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, contentType: 'application/json' }
      );
    } catch (err) {
      logger.error('Publish failed', err as Error);
      return false;
    }
  }

  async consume(queue: string, handler: (msg: object) => Promise<void>): Promise<void> {
    if (!this.channel) throw new Error('Channel not available');
    const channel = this.channel;

    await channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        channel.ack(msg);
      } catch (err) {
        logger.error('Message handling failed', err as Error);
        channel.nack(msg, false, !msg.fields.redelivered);
      }
    });

    logger.info(`Consuming from: ${queue}`);
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