import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  FSMEngine,
  WorkerPoolManager,
  InMemoryTelemetryStore,
  VegamScenarioConfig,
  RuntimeLimiter,
  QuotaTracker,
  VegamGovernor,
  EventPacket,
  SSRFGuard
} from '@vegam/engine';
import {
  KafkaAdapter,
  RabbitMQAdapter,
  MQTTAdapter,
  NatsAdapter,
  HTTPAdapter,
  IOutboundConnector
} from '@vegam/connectors';
import { getTemplateById } from '@vegam/templates';

// Governor state is controlled exclusively by the server environment variable.
// It cannot be overridden by request body parameters.
if (process.env.VEGAM_GOVERNOR_ENABLED === 'true') {
  VegamGovernor.setEnabled(true);
}

export const dynamic = 'force-dynamic';

// Max allowed request body size (64 KB). Prevents OOM on crafted payloads.
const MAX_BODY_BYTES = 65_536;

function createConnectorAdapter(protocol: string): IOutboundConnector {
  switch ((protocol || '').toUpperCase()) {
    case 'KAFKA':
      return new KafkaAdapter();
    case 'AMQP':
      return new RabbitMQAdapter();
    case 'MQTT':
      return new MQTTAdapter();
    case 'NATS':
      return new NatsAdapter();
    case 'WEBHOOK':
    case 'HTTP':
    default:
      return new HTTPAdapter();
  }
}

export async function POST(req: Request) {
  try {
    // Read raw buffer directly to enforce actual byte size limit (prevent Content-Length header bypass)
    const rawBuffer = await req.arrayBuffer();
    if (rawBuffer.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: 'Request body too large.' }, { status: 413 });
    }

    let body: any = {};
    if (rawBuffer.byteLength > 0) {
      try {
        const text = new TextDecoder().decode(rawBuffer);
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }

    // Never allow client-provided body parameters to influence governor state
    if ('governorEnabled' in body) {
      delete body.governorEnabled;
    }

    const { scenarioId, scenarioConfig, rateHz = 100, durationSec = 3, activeConnection } = body;

    let activeScenario: VegamScenarioConfig | undefined = scenarioConfig;
    if (!activeScenario && scenarioId) {
      activeScenario = getTemplateById(scenarioId);
    }
    if (!activeScenario) {
      activeScenario = getTemplateById('ecommerce-checkout-v1');
    }

    if (!activeScenario) {
      return NextResponse.json({ error: 'No valid scenario configuration specified.' }, { status: 400 });
    }

    const startMs = Date.now();
    const runId = `run-${startMs}`;

    const clampedRate = RuntimeLimiter.clampEmissionRate(Number(rateHz) || 10);
    // Hard-clamp durationSec: max 30s on hosted tier, max 300s locally — prevents infinite compute loops.
    const MAX_DURATION_SEC = process.env.VEGAM_GOVERNOR_ENABLED === 'true' ? 30 : 300;
    const clampedDuration = Math.min(Math.max(1, Number(durationSec) || 3), MAX_DURATION_SEC);
    const totalEvents = clampedRate * clampedDuration;

    // Dynamically sized request-scoped columnar telemetry store to avoid memory over-allocation
    const storeCapacity = Math.min(50_000, Math.max(100, totalEvents + 500));
    const telemetryStore = new InMemoryTelemetryStore(storeCapacity);

    // Initialize Outbound Connector if activeConnection / target broker is provided
    let outboundConnector: IOutboundConnector | null = null;
    if (activeConnection && activeConnection.bootstrapServers) {
      try {
        // Validate target before opening any socket
        await SSRFGuard.assertSafeTarget(activeConnection.bootstrapServers);
        outboundConnector = createConnectorAdapter(activeConnection.protocol || 'KAFKA');
        await outboundConnector.connect(activeConnection.bootstrapServers, {
          username: activeConnection.username,
          password: activeConnection.password,
          apiKey: activeConnection.apiKey,
          ssl: activeConnection.ssl || activeConnection.bootstrapServers.includes('ssl://')
        });
        console.info(`[API/simulate] Outbound connector active: ${activeConnection.protocol} to ${activeConnection.bootstrapServers}`);
      } catch {
        // Swallow error details to prevent credential/URI leakage in server logs.
        console.warn('[API/simulate] Broker connection failed, continuing in local simulation mode.');
      }
    }

    const fsmEngine = new FSMEngine(activeScenario.nodes, activeScenario.anomalyThresholdBits);
    const workerPool = new WorkerPoolManager(fsmEngine);

    const batchSize = Math.min(50, Math.max(1, Math.floor(clampedRate / 10)));
    const numBatches = Math.ceil(totalEvents / batchSize);

    const allPackets: EventPacket[] = [];
    const firstNodeId = activeScenario.nodes[0]?.nodeId || 'node-1';

    for (let b = 0; b < numBatches; b++) {
      const batchResult = await workerPool.executeBatch({
        runId,
        startNodeId: firstNodeId,
        batchSize
      });
      allPackets.push(...batchResult.packets);

      let batchLatencyMs = batchResult.durationMs / Math.max(1, batchResult.packets.length);

      // Emit live packets across real broker socket
      if (outboundConnector) {
        try {
          const emitStart = performance.now();
          await outboundConnector.emitBatch(batchResult.packets);
          const emitElapsed = performance.now() - emitStart;
          batchLatencyMs = emitElapsed / Math.max(1, batchResult.packets.length);
        } catch (emitErr) {
          console.warn('[API/simulate] Outbound broker batch emit error:', emitErr);
        }
      }

      telemetryStore.flushBatch(runId, batchResult.packets, batchLatencyMs);
      QuotaTracker.consume(JSON.stringify(batchResult.packets).length);

      // Brief yield
      if (numBatches > 5) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }

    workerPool.destroy();
    if (outboundConnector) {
      try { await outboundConnector.disconnect(); } catch { /* ignore disconnect errors on cleanup */ }
    }

    const elapsedMs = Date.now() - startMs;
    const actualThroughputHz = Math.round((allPackets.length / Math.max(0.1, elapsedMs / 1000)));
    const avgEntropyBits = fsmEngine.getSurprisalEngine().getShannonEntropy();
    const anomalyPackets = allPackets.filter((p) => p.isAnomaly);

    const timeBuckets = telemetryStore.queryTimeBuckets(runId, 30);
    const quotaStatus = QuotaTracker.getStatus();

    return NextResponse.json({
      success: true,
      runId,
      elapsedMs,
      actualThroughputHz,
      avgEntropyBits,
      totalEventsGenerated: allPackets.length,
      anomalyCount: anomalyPackets.length,
      timeBuckets,
      quotaStatus,
      recentPackets: allPackets.slice(-100), // Return latest 100 packets for inspection
      anomalies: anomalyPackets.slice(-50)
    });
  } catch (err: unknown) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[API/simulate] [${errorId}] Simulation error:`, err);
    
    // In hosted/governor mode, sanitize error to avoid leaking internal architecture/stack traces
    const isHosted = process.env.VEGAM_GOVERNOR_ENABLED === 'true';
    const errorMessage = isHosted
      ? `Simulation execution failed. (Ref: ${errorId})`
      : err instanceof Error ? err.message : String(err);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorId
    }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    success: true,
    status: 'operational',
    service: 'vegam-simulation-engine',
    governorEnabled: process.env.VEGAM_GOVERNOR_ENABLED === 'true',
    quotaStatus: QuotaTracker.getStatus()
  });
}

