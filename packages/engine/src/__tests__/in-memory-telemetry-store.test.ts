import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTelemetryStore } from '../storage/in-memory-telemetry-store.js';
import { EventPacket } from '../simulation/fsm-engine.js';

test('InMemoryTelemetryStore - records batches with exact execution latencies and queries time buckets', () => {
  const store = new InMemoryTelemetryStore(1000);
  const runId = 'run-test-1';

  const packet1: EventPacket = {
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

  const packet2: EventPacket = {
    packetId: 'pkt-2',
    correlationId: 'corr-2',
    timestamp: Date.now(),
    nodeId: 'node-b',
    protocol: 'KAFKA',
    targetTopicOrUri: 'topic.b',
    payload: { hello: 'world', data: 12345 },
    surprisalBits: 7.2,
    isAnomaly: true,
    fieldBreakdown: {},
    executionLatencyMs: 0.88
  };

  store.flushBatch(runId, [packet1, packet2]);

  assert.equal(store.getTotalEventCount(), 2);

  const buckets = store.queryTimeBuckets(runId);
  assert.equal(buckets.length, 1);
  const bucket = buckets[0];
  assert.equal(bucket.throughputEvSec, 2);
  assert.equal(bucket.anomalyCount, 1);
  assert.ok(bucket.p50Latency >= 0.42 && bucket.p50Latency <= 0.88);
  assert.ok(bucket.avgEntropyBits > 0);
});

test('InMemoryTelemetryStore - cycles ring buffer cleanly when capacity reached', () => {
  const store = new InMemoryTelemetryStore(5); // Small capacity = 5
  const runId = 'run-ring-test';

  for (let i = 0; i < 8; i++) {
    const pkt: EventPacket = {
      packetId: `pkt-${i}`,
      correlationId: `corr-${i}`,
      timestamp: Date.now(),
      nodeId: 'node-test',
      protocol: 'KAFKA',
      targetTopicOrUri: 'topic.test',
      payload: { index: i },
      surprisalBits: 1.0,
      isAnomaly: false,
      fieldBreakdown: {},
      executionLatencyMs: 0.1
    };
    store.flushBatch(runId, [pkt]);
  }

  // Total recorded is 8, but active ring buffer stores max capacity (5)
  assert.equal(store.getTotalEventCount(), 8);
  const buckets = store.queryTimeBuckets(runId);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].throughputEvSec, 5);
});

test('InMemoryTelemetryStore - resets columnar arrays cleanly', () => {
  const store = new InMemoryTelemetryStore(100);
  const pkt: EventPacket = {
    packetId: 'pkt-z',
    correlationId: 'corr-z',
    timestamp: Date.now(),
    nodeId: 'node-z',
    protocol: 'KAFKA',
    targetTopicOrUri: 'topic.z',
    payload: {},
    surprisalBits: 1.0,
    isAnomaly: false,
    fieldBreakdown: {}
  };
  store.flushBatch('run-z', [pkt]);
  assert.equal(store.getTotalEventCount(), 1);

  store.reset();
  assert.equal(store.getTotalEventCount(), 0);
  assert.equal(store.queryTimeBuckets('run-z').length, 0);
});
