import { EventPacket } from '@vegam/engine';
import { IOutboundConnector, EmitResult, HealthStatus, AuthOptions } from './connector-pool.js';
import mqtt, { MqttClient } from 'mqtt';

/**
 * MQTT v5 Outbound Adapter (`mqtt`).
 */
export class MQTTAdapter implements IOutboundConnector {
  private client: MqttClient | null = null;
  private targetUri = '';
  private isConnected = false;
  private lastLatencyMs = 0;

  public async connect(uri: string, auth?: AuthOptions): Promise<void> {
    this.targetUri = uri;
    try {
      let connectUrl = uri;
      if (!uri.startsWith('mqtt://') && !uri.startsWith('mqtts://') && !uri.startsWith('ws://') && !uri.startsWith('wss://')) {
        connectUrl = `mqtt://${uri}`;
      }

      this.client = mqtt.connect(connectUrl, {
        protocolVersion: 5,
        username: auth?.username,
        password: auth?.password,
        connectTimeout: 3000
      });

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('MQTT connect timeout')), 3000);
        this.client?.on('connect', () => {
          clearTimeout(timer);
          resolve();
        });
        this.client?.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      this.isConnected = true;
      console.info(`[MQTTAdapter] Connected to MQTT broker: ${uri}`);
    } catch (err) {
      console.error(`[MQTTAdapter] MQTT broker at ${uri} unreachable (${String(err)}).`);
      throw new Error('MQTT broker connection failed.');
    }
  }

  public async emitBatch(packets: ReadonlyArray<EventPacket>): Promise<EmitResult> {
    if (!this.isConnected || packets.length === 0) {
      return { success: false, emittedCount: 0, latencyMs: 0, errorDetails: 'MQTT adapter not connected' };
    }

    const start = Date.now();

    if (!this.client) {
      return { success: false, emittedCount: 0, latencyMs: Date.now() - start, errorDetails: 'MQTT client not initialized' };
    }

    try {
      for (const pkt of packets) {
        const topic = pkt.targetTopicOrUri || 'vegam/telemetry';
        await new Promise<void>((resolve, reject) => {
          this.client?.publish(topic, JSON.stringify(pkt.payload), { qos: 1 }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      this.lastLatencyMs = Math.max(1, Date.now() - start);
      return { success: true, emittedCount: packets.length, latencyMs: this.lastLatencyMs };
    } catch (err) {
      console.error('[MQTTAdapter] Emit batch failed:', err);
      return { success: false, emittedCount: 0, latencyMs: Date.now() - start, errorDetails: String(err) };
    }
  }

  public async assertHealth(): Promise<HealthStatus> {
    return {
      isHealthy: this.isConnected,
      protocol: 'MQTT',
      targetUri: this.targetUri,
      lastLatencyMs: this.lastLatencyMs,
      details: 'Real MQTT v5 socket connected'
    };
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await new Promise<void>((resolve) => this.client?.end(false, {}, () => resolve()));
    }
    this.isConnected = false;
  }
}
