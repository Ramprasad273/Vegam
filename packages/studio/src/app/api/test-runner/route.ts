import { NextRequest, NextResponse } from 'next/server';
import assert from 'node:assert/strict';

/** Dummy HMAC key for the in-process HTTPAdapter test — never a real secret. */
const TEST_ADAPTER_DUMMY_KEY = 'vegam-test-hmac-dummy-00000000';

// Engine imports
import {
  SurprisalEngine,
  FieldSurprisalRule,
  FSMEngine,
  SimulationNodeConfig,
  EventPacket,
  SynthesisEngine,
  FieldSynthesisRule,
  InMemoryTelemetryStore,
  SSRFGuard,
  isInternalOrRestrictedIP,
  RuntimeLimiter,
  WorkerPoolManager,
  SimulationNodeSchema
} from '@vegam/engine';

// Connectors & Templates imports
import { HTTPAdapter } from '@vegam/connectors';
import { ALL_TEMPLATES } from '@vegam/templates';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export async function GET(req: NextRequest) {
  if (process.env.VEGAM_GOVERNOR_ENABLED === 'true') {
    // In hosted/governor mode, test-runner must be explicitly enabled to prevent compute DoS
    if (process.env.VEGAM_TEST_RUNNER_ENABLED !== 'true') {
      return NextResponse.json(
        { success: false, error: 'Test runner execution is disabled on the hosted tier. Run locally via CLI.' },
        { status: 403 }
      );
    }

    const token = req.headers.get('x-vegam-health-token');
    if (!token || token !== process.env.VEGAM_HEALTH_TOKEN) {
      return NextResponse.json({ success: false, error: 'Unauthorized test-runner execution.' }, { status: 401 });
    }
  }

  const results: TestResult[] = [];

  async function runTest(suite: string, name: string, fn: () => void | Promise<void>) {
    const start = performance.now();
    try {
      await fn();
      results.push({ suite, name, passed: true, durationMs: Number((performance.now() - start).toFixed(2)) });
    } catch (err: unknown) {
      results.push({
        suite,
        name,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Number((performance.now() - start).toFixed(2))
      });
    }
  }

  // 1. SurprisalEngine tests
  await runTest('SurprisalEngine', 'computes exact self-information I(x) for categorical probabilities', () => {
    const engine = new SurprisalEngine(6.0);
    const rules: FieldSurprisalRule[] = [
      { fieldName: 'currency', type: 'categorical', categoricalWeights: { USD: 0.8, EUR: 0.15, JPY: 0.05 }, weight: 1.0 }
    ];
    const scoreUsd = engine.scorePacket({ currency: 'USD' }, rules);
    assert.equal(scoreUsd.isAnomaly, false);
    assert.ok(Math.abs(scoreUsd.totalSurprisalBits - 0.3219) < 0.01, `Expected ~0.3219, got ${scoreUsd.totalSurprisalBits}`);
  });

  await runTest('SurprisalEngine', 'detects anomalies when total surprisal exceeds anomalyThresholdBits', () => {
    const engine = new SurprisalEngine(4.0);
    const rules: FieldSurprisalRule[] = [
      { fieldName: 'status', type: 'categorical', categoricalWeights: { OK: 0.99, CRITICAL_ERR: 0.005 }, weight: 1.0 }
    ];
    const scoreErr = engine.scorePacket({ status: 'CRITICAL_ERR' }, rules);
    assert.equal(scoreErr.isAnomaly, true);
    assert.ok(scoreErr.totalSurprisalBits > 4.0);
  });

  await runTest('SurprisalEngine', 'computes exact KL Divergence D(P || Q)', () => {
    const p = [0.5, 0.5];
    const q = [0.25, 0.75];
    const kl = SurprisalEngine.computeKLDivergence(p, q);
    assert.ok(Math.abs(kl - 0.2075) < 0.01);
  });

  // 2. FSMEngine tests
  await runTest('FSMEngine', 'steps node and generates valid EventPacket with executionLatencyMs', () => {
    const nodes: SimulationNodeConfig[] = [
      {
        nodeId: 'node-start',
        nodeName: 'Gateway Node',
        nodeType: 'producer',
        protocol: 'KAFKA',
        targetTopicOrUri: 'events.raw',
        synthesisRules: [
          { fieldName: 'orderId', ruleExpression: '"ORD-101"' },
          { fieldName: 'status', ruleExpression: '"NEW"' }
        ]
      }
    ];
    const engine = new FSMEngine(nodes);
    const result = engine.stepNode('node-start');
    assert.ok(result.packet);
    assert.equal(result.packet.nodeId, 'node-start');
    assert.equal(typeof result.packet.executionLatencyMs, 'number');
    assert.ok((result.packet.executionLatencyMs ?? -1) >= 0);
  });

  await runTest('FSMEngine', 'propagates correlationId and $PREV variables from parentPacket', () => {
    const nodes: SimulationNodeConfig[] = [
      {
        nodeId: 'node-downstream',
        nodeName: 'Fulfillment Service',
        nodeType: 'producer',
        protocol: 'KAFKA',
        targetTopicOrUri: 'events.fulfilled',
        synthesisRules: [
          { fieldName: 'orderId', ruleExpression: '$PREV.orderId' },
          { fieldName: 'status', ruleExpression: '"CONFIRMED"' }
        ]
      }
    ];
    const engine = new FSMEngine(nodes);
    const parentPacket: EventPacket = {
      packetId: 'pkt-parent',
      correlationId: 'corr-xyz-999',
      timestamp: Date.now(),
      nodeId: 'node-start',
      protocol: 'KAFKA',
      targetTopicOrUri: 'events.raw',
      payload: { orderId: 'ORD-5555' },
      surprisalBits: 1.0,
      isAnomaly: false,
      fieldBreakdown: {}
    };
    const result = engine.stepNode('node-downstream', parentPacket);
    assert.ok(result.packet);
    assert.equal(result.packet.correlationId, 'corr-xyz-999');
    assert.equal(result.packet.payload['orderId'], 'ORD-5555');
  });

  // 3. SynthesisEngine tests
  await runTest('SynthesisEngine', 'evaluates $NOW_MS and $NOW_ISO system variables', () => {
    const rules: FieldSynthesisRule[] = [
      { fieldName: 'ts', ruleExpression: '$NOW_MS' },
      { fieldName: 'iso', ruleExpression: '$NOW_ISO' }
    ];
    const payload = SynthesisEngine.synthesizePayload(rules);
    assert.equal(typeof payload['ts'], 'number');
    assert.equal(typeof payload['iso'], 'string');
  });

  await runTest('SynthesisEngine', 'evaluates regex pattern expressions and helpers without eval()', () => {
    const rules: FieldSynthesisRule[] = [
      { fieldName: 'code', ruleExpression: '/^1Z[A-Z0-9]{16}$/' },
      { fieldName: 'amount', ruleExpression: 'faker.number.float({min:10,max:20,fractionDigits:2})' }
    ];
    const payload = SynthesisEngine.synthesizePayload(rules);
    assert.ok(String(payload['code']).startsWith('1Z'));
    assert.ok(Number(payload['amount']) >= 10 && Number(payload['amount']) <= 20);
  });

  // 4. InMemoryTelemetryStore tests
  await runTest('InMemoryTelemetryStore', 'records batches with exact execution latencies and queries time buckets', () => {
    const store = new InMemoryTelemetryStore(1000);
    const pkt: EventPacket = {
      packetId: 'pkt-1',
      correlationId: 'corr-1',
      timestamp: Date.now(),
      nodeId: 'node-a',
      protocol: 'KAFKA',
      targetTopicOrUri: 'topic.a',
      payload: { foo: 'bar' },
      surprisalBits: 2.5,
      isAnomaly: false,
      fieldBreakdown: {},
      executionLatencyMs: 0.42
    };
    store.flushBatch('run-test-1', [pkt]);
    assert.equal(store.getTotalEventCount(), 1);
    const buckets = store.queryTimeBuckets('run-test-1');
    assert.equal(buckets.length, 1);
    assert.equal(buckets[0]?.throughputEvSec, 1);
  });

  // 5. Governor & SSRFGuard tests
  await runTest('SSRFGuard & RuntimeLimiter', 'correctly identifies internal/restricted IPs and checks payload bounds', async () => {
    assert.equal(isInternalOrRestrictedIP('127.0.0.1'), true);
    assert.equal(isInternalOrRestrictedIP('169.254.169.254'), true);
    assert.equal(isInternalOrRestrictedIP('8.8.8.8'), false);

    const initialGov = process.env.VEGAM_GOVERNOR_ENABLED === 'true';
    RuntimeLimiter._setGovernorForTests(true);
    try {
      const clamped = RuntimeLimiter.clampEmissionRate(500);
      assert.ok(clamped <= 100);
      assert.throws(() => RuntimeLimiter.assertPayloadSize(100_000), /Payload size .* exceeds Governor cap/);
    } finally {
      RuntimeLimiter._setGovernorForTests(initialGov);
    }
  });

  // 6. WorkerPoolManager tests
  await runTest('WorkerPoolManager', 'executes batch and returns valid packets and duration', async () => {
    const nodes: SimulationNodeConfig[] = [
      {
        nodeId: 'node-worker-test',
        nodeName: 'Worker Node',
        nodeType: 'producer',
        protocol: 'KAFKA',
        targetTopicOrUri: 'worker.topic',
        synthesisRules: [{ fieldName: 'id', ruleExpression: 'faker.string.uuid()' }]
      }
    ];
    const engine = new FSMEngine(nodes);
    const pool = new WorkerPoolManager(engine);
    const result = await pool.executeBatch({ runId: 'run-worker-1', startNodeId: 'node-worker-test', batchSize: 5 });
    assert.equal(result.packets.length, 5);
    assert.ok(result.durationMs >= 0);
    pool.destroy();
  });

  // 7. Connectors HTTPAdapter tests
  await runTest('HTTPAdapter', 'connects, formats target URI, and asserts health cleanly', async () => {
    const adapter = new HTTPAdapter();
    await adapter.connect('localhost:9999/webhook', { apiKey: TEST_ADAPTER_DUMMY_KEY });
    const health = await adapter.assertHealth();
    assert.equal(health.isHealthy, true);
    assert.equal(health.targetUri, 'http://localhost:9999/webhook');
    await adapter.disconnect();
  });

  // 8. Templates tests
  await runTest('Templates', 'all pre-packaged templates conform to SimulationNodeSchema', () => {
    assert.equal(ALL_TEMPLATES.length, 4);
    for (const template of ALL_TEMPLATES) {
      assert.ok(template.scenarioId);
      for (const node of template.nodes) {
        const parsed = SimulationNodeSchema.parse(node);
        assert.equal(parsed.nodeId, node.nodeId);
      }
    }
  });

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return NextResponse.json({
    success: failedCount === 0,
    totalTests: results.length,
    passedTests: passedCount,
    failedTests: failedCount,
    results
  });
}
