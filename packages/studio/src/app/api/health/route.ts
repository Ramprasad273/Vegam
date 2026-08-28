import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { KafkaAdapter, RabbitMQAdapter, MQTTAdapter, NatsAdapter, HTTPAdapter } from '@vegam/connectors';
import { SSRFGuard, PortWhitelistGuard } from '@vegam/engine';

/**
 * Extracts the TCP port from a URI or host:port string.
 * Returns null if no port is present.
 */
function extractPort(uri: string): number | null {
  try {
    if (uri.includes('://')) {
      const { port } = new URL(uri);
      return port ? parseInt(port, 10) : null;
    }
    const parts = uri.split(':');
    const last = parts[parts.length - 1]?.split('/')[0];
    const port = last ? parseInt(last, 10) : NaN;
    return Number.isNaN(port) ? null : port;
  } catch {
    return null;
  }
}

/**
 * POST /api/health
 *
 * Tests connectivity to a user-supplied broker URI.
 * Enforces SSRF and port whitelist checks before attempting any connection.
 * Credentials are used for this request only and never persisted server-side.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { protocol, uri } = body;

    if (!protocol || typeof protocol !== 'string') {
      return NextResponse.json({ success: false, error: 'protocol is required' }, { status: 400 });
    }
    if (!uri || typeof uri !== 'string') {
      return NextResponse.json({ success: false, error: 'uri is required' }, { status: 400 });
    }

    // SSRF guard: resolve and validate the target host before any socket attempt
    try {
      await SSRFGuard.assertSafeTarget(uri);
    } catch (err: unknown) {
      console.warn('[API/health] SSRF check blocked connection attempt:', uri);
      return NextResponse.json(
        { success: false, error: 'Target host is not permitted.' },
        { status: 403 }
      );
    }

    // Port whitelist guard
    const port = extractPort(uri);
    if (port !== null) {
      try {
        PortWhitelistGuard.assertAllowedPort(port);
      } catch {
        return NextResponse.json(
          { success: false, error: `Port ${port} is not permitted for broker connections.` },
          { status: 403 }
        );
      }
    }

    let adapter;
    switch (protocol.toUpperCase()) {
      case 'KAFKA':
        adapter = new KafkaAdapter();
        break;
      case 'AMQP':
      case 'RABBITMQ':
        adapter = new RabbitMQAdapter();
        break;
      case 'MQTT':
        adapter = new MQTTAdapter();
        break;
      case 'NATS':
        adapter = new NatsAdapter();
        break;
      case 'WEBHOOK':
      case 'HTTP':
        adapter = new HTTPAdapter();
        break;
      default:
        return NextResponse.json({ success: false, error: `Unknown protocol: ${protocol}` }, { status: 400 });
    }

    try {
      await adapter.connect(uri, {});
      const health = await adapter.assertHealth();
      await adapter.disconnect();

      if (!health.isHealthy) {
        return NextResponse.json({
          success: false,
          error: `Unable to reach ${protocol} broker at specified target.`
        });
      }

      return NextResponse.json({
        success: true,
        latencyMs: health.lastLatencyMs || 0,
        protocolVersion: protocol === 'KAFKA' ? '3.5.1' : 'unknown'
      });
    } catch (e: unknown) {
      const errorId = crypto.randomUUID().slice(0, 8);
      console.error(`[API/health] [${errorId}] Broker check failed:`, e);
      return NextResponse.json({
        success: false,
        error: `Broker connection check failed. (Ref: ${errorId})`,
        errorId
      });
    }
  } catch (err: unknown) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[API/health] [${errorId}] Health request error:`, err);
    return NextResponse.json({
      success: false,
      error: `Health request failed. (Ref: ${errorId})`,
      errorId
    }, { status: 500 });
  }
}
