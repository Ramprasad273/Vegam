import { EventPacket } from '@vegam/engine';
import { IOutboundConnector, EmitResult, HealthStatus, AuthOptions } from './connector-pool.js';
import amqplib, { Channel, ChannelModel } from 'amqplib';

/**
 * RabbitMQ AMQP 0-9-1 Outbound Adapter (`amqplib`).
 */
export class RabbitMQAdapter implements IOutboundConnector {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private targetUri = '';
  private isConnected = false;
  private lastLatencyMs = 0;

  public async connect(uri: string, auth?: AuthOptions): Promise<void> {
    this.targetUri = uri;
    try {
      let connectUrl = uri;
      if (!uri.startsWith('amqp://') && !uri.startsWith('amqps://')) {
        connectUrl = `amqp://${uri}`;
      }

      this.connection = await Promise.race([
        amqplib.connect(connectUrl),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AMQP connect timeout')), 3000))
      ]);

      if (this.connection && typeof this.connection.createChannel === 'function') {
        this.channel = await this.connection.createChannel();
      }
      this.isConnected = true;
      console.info(`[RabbitMQAdapter] Connected to RabbitMQ broker: ${uri}`);
    } catch (err) {
      console.error(`[RabbitMQAdapter] RabbitMQ broker at ${uri} unreachable (${String(err)}).`);
      throw new Error('RabbitMQ broker connection failed.');
    }
  }

  public async emitBatch(packets: ReadonlyArray<EventPacket>): Promise<EmitResult> {
    if (!this.isConnected || packets.length === 0) {
      return { success: false, emittedCount: 0, latencyMs: 0, errorDetails: 'RabbitMQ adapter not connected' };
    }

    const start = Date.now();

    if (!this.channel) {
      return { success: false, emittedCount: 0, latencyMs: Date.now() - start, errorDetails: 'AMQP channel not initialized' };
    }

    try {
      for (const pkt of packets) {
        const exchangeOrQueue = pkt.targetTopicOrUri || 'vegam-queue';
        const buffer = Buffer.from(JSON.stringify(pkt.payload), 'utf8');
        // If target contains '.', publish to topic exchange, otherwise direct queue
        if (exchangeOrQueue.includes('.')) {
          const parts = exchangeOrQueue.split('.');
          const exchange = parts[0] || 'amq.topic';
          const routingKey = parts.slice(1).join('.');
          this.channel.publish(exchange, routingKey, buffer, {
            correlationId: pkt.correlationId,
            contentType: 'application/json'
          });
        } else {
          this.channel.sendToQueue(exchangeOrQueue, buffer, {
            correlationId: pkt.correlationId,
            contentType: 'application/json'
          });
        }
      }

      this.lastLatencyMs = Math.max(1, Date.now() - start);
      return { success: true, emittedCount: packets.length, latencyMs: this.lastLatencyMs };
    } catch (err) {
      console.error('[RabbitMQAdapter] Emit batch failed:', err);
      return { success: false, emittedCount: 0, latencyMs: Date.now() - start, errorDetails: String(err) };
    }
  }

  public async assertHealth(): Promise<HealthStatus> {
    return {
      isHealthy: this.isConnected,
      protocol: 'AMQP',
      targetUri: this.targetUri,
      lastLatencyMs: this.lastLatencyMs,
      details: 'Real RabbitMQ socket connected'
    };
  }

  public async disconnect(): Promise<void> {
    if (this.channel && typeof this.channel.close === 'function') await this.channel.close();
    if (this.connection && typeof this.connection.close === 'function') await this.connection.close();
    this.isConnected = false;
  }
}
