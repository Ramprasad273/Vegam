import { EventPacket } from '@vegam/engine';
import { IOutboundConnector, EmitResult, HealthStatus, AuthOptions } from './connector-pool.js';
import { connect, NatsConnection, StringCodec } from 'nats';

/**
 * NATS / JetStream Outbound Adapter (`nats`).
 */
export class NatsAdapter implements IOutboundConnector {
  private natsConnection: NatsConnection | null = null;
  private readonly sc = StringCodec();
  private targetUri = '';
  private isConnected = false;
  private lastLatencyMs = 0;

  public async connect(uri: string, auth?: AuthOptions): Promise<void> {
    this.targetUri = uri;
    try {
      this.natsConnection = await Promise.race([
        connect({
          servers: uri.includes(',') ? uri.split(',') : [uri],
          user: auth?.username,
          pass: auth?.password
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('NATS connect timeout')), 3000))
      ]);
      this.isConnected = true;
      console.info(`[NatsAdapter] Connected to NATS broker: ${uri}`);
    } catch (err) {
      console.error(`[NatsAdapter] NATS broker at ${uri} unreachable (${String(err)}).`);
      throw new Error('NATS broker connection failed.');
    }
  }

  public async emitBatch(packets: ReadonlyArray<EventPacket>): Promise<EmitResult> {
    if (!this.isConnected || packets.length === 0) {
      return { success: false, emittedCount: 0, latencyMs: 0, errorDetails: 'NATS adapter not connected' };
    }

    const start = Date.now();

    if (!this.natsConnection) {
      return { success: false, emittedCount: 0, latencyMs: Date.now() - start, errorDetails: 'NATS connection not initialized' };
    }

    try {
      for (const pkt of packets) {
        const subject = pkt.targetTopicOrUri || 'vegam.events';
        const payloadBytes = this.sc.encode(JSON.stringify(pkt.payload));
        this.natsConnection.publish(subject, payloadBytes);
      }
      await this.natsConnection.flush();

      this.lastLatencyMs = Math.max(1, Date.now() - start);
      return { success: true, emittedCount: packets.length, latencyMs: this.lastLatencyMs };
    } catch (err) {
      console.error('[NatsAdapter] Emit batch failed:', err);
      return { success: false, emittedCount: 0, latencyMs: Date.now() - start, errorDetails: String(err) };
    }
  }

  public async assertHealth(): Promise<HealthStatus> {
    return {
      isHealthy: this.isConnected,
      protocol: 'NATS',
      targetUri: this.targetUri,
      lastLatencyMs: this.lastLatencyMs,
      details: 'Real NATS socket connected'
    };
  }

  public async disconnect(): Promise<void> {
    if (this.natsConnection) {
      await this.natsConnection.close();
    }
    this.isConnected = false;
  }
}
