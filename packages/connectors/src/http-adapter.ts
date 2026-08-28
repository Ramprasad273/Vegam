import { EventPacket, SSRFGuard } from '@vegam/engine';
import { IOutboundConnector, EmitResult, HealthStatus, AuthOptions } from './connector-pool.js';
import crypto from 'node:crypto';
import axios from 'axios';

/**
 * HTTP/REST Webhook Outbound Adapter.
 * Signs outbound payloads with HMAC-SHA256 (`x-vegam-signature`) when `apiKey` / secret is configured.
 */
export class HTTPAdapter implements IOutboundConnector {
  private targetUri = '';
  private secretKey = '';
  private isConnected = false;
  private lastLatencyMs = 0;

  public async connect(uri: string, auth?: AuthOptions): Promise<void> {
    try {
      let target = uri;
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = `http://${target}`;
      }
      await SSRFGuard.assertSafeTarget(target);
      this.targetUri = target;
      this.secretKey = auth?.apiKey ?? '';
      this.isConnected = true;
      console.info(`[HTTPAdapter] Ready to emit HTTP POST webhooks to: ${this.targetUri}`);
    } catch (err) {
      if (err instanceof Error && err.name === 'SecurityViolationException') {
        throw err;
      }
      console.error(`[HTTPAdapter] Failed to initialize webhook target (${String(err)}).`);
      throw new Error('Webhook target initialization failed.');
    }
  }

  public async emitBatch(packets: ReadonlyArray<EventPacket>): Promise<EmitResult> {
    if (!this.isConnected || packets.length === 0) {
      return { success: false, emittedCount: 0, latencyMs: 0, errorDetails: 'HTTP adapter not connected' };
    }

    const start = Date.now();
    try {
      // Assert safe target on every batch immediately before dispatch to mitigate DNS rebinding (TOCTOU)
      await SSRFGuard.assertSafeTarget(this.targetUri);

      const payloadBody = packets.length === 1 && packets[0] ? packets[0].payload : packets.map((p) => p.payload);
      const jsonStr = JSON.stringify(payloadBody);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'vegam-engine-webhook/1.0.0',
        'X-Vegam-Batch-Size': String(packets.length)
      };

      if (this.secretKey) {
        const hmac = crypto.createHmac('sha256', this.secretKey).update(jsonStr).digest('hex');
        headers['X-Vegam-Signature'] = `sha256=${hmac}`;
      }

      const response = await axios.post(this.targetUri, jsonStr, {
        headers,
        timeout: 5000,
        validateStatus: (status) => status < 500 // Don't throw on 4xx so we capture cleanly
      });

      this.lastLatencyMs = Math.max(1, Date.now() - start);
      return {
        success: response.status >= 200 && response.status < 300,
        emittedCount: packets.length,
        latencyMs: this.lastLatencyMs,
        errorDetails: response.status >= 300 ? `HTTP ${response.status}: ${response.statusText}` : undefined
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'SecurityViolationException') {
        return {
          success: false,
          emittedCount: 0,
          latencyMs: Date.now() - start,
          errorDetails: 'Target blocked by SSRF Governor'
        };
      }
      console.error(`[HTTPAdapter] Webhook emit error (${String(err)}).`);
      return {
        success: false,
        emittedCount: 0,
        latencyMs: Date.now() - start,
        errorDetails: 'Webhook delivery failed'
      };
    }
  }

  public async assertHealth(): Promise<HealthStatus> {
    return {
      isHealthy: this.isConnected,
      protocol: 'HTTP',
      targetUri: this.targetUri,
      lastLatencyMs: this.lastLatencyMs,
      details: 'HTTP Webhook Adapter Active'
    };
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
  }
}
