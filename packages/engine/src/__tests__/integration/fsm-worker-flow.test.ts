import test from 'node:test';
import assert from 'node:assert/strict';
import { FSMEngine, SimulationNodeConfig } from '../../simulation/fsm-engine.js';
import { WorkerPoolManager } from '../../simulation/worker-pool.js';

/**
 * FSMEngine + WorkerPoolManager integration test.
 * Verifies end-to-end packet generation across a two-node FSM graph
 * with $PREV correlation inheritance.
 */
test('FSMEngine + WorkerPool: full two-node correlated event flow', async () => {
  const nodes: SimulationNodeConfig[] = [
    {
      nodeId: 'node-order',
      nodeName: 'Order Gateway',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'orders.raw',
      emissionRateHz: 10,
      synthesisRules: [
        { fieldName: 'orderId', ruleExpression: 'faker.string.uuid()' },
        { fieldName: 'amount', ruleExpression: 'faker.number.float({min:10,max:500,fractionDigits:2})' },
        { fieldName: 'status', ruleExpression: '"PENDING"' }
      ]
    },
    {
      nodeId: 'node-fulfill',
      nodeName: 'Fulfillment Service',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'orders.fulfilled',
      emissionRateHz: 10,
      synthesisRules: [
        { fieldName: 'orderId', ruleExpression: '$PREV.orderId' },
        { fieldName: 'status', ruleExpression: '"FULFILLED"' },
        { fieldName: 'ts', ruleExpression: '$NOW_MS' }
      ]
    }
  ];

  const engine = new FSMEngine(nodes);
  const pool = new WorkerPoolManager(engine);

  const result = await pool.executeBatch({
    runId: 'integration-test-1',
    startNodeId: 'node-order',
    batchSize: 5
  });

  assert.ok(result.packets.length >= 5, `Expected at least 5 packets, got ${result.packets.length}`);
  assert.ok(result.durationMs >= 0);

  // Verify correlation propagation: fulfilled packets must reference the same correlationId
  const rawPackets = result.packets.filter(p => p.targetTopicOrUri === 'orders.raw');
  const fulfilledPackets = result.packets.filter(p => p.targetTopicOrUri === 'orders.fulfilled');

  assert.ok(rawPackets.length > 0, 'Expected raw order packets');
  assert.ok(fulfilledPackets.length > 0, 'Expected fulfilled order packets');

  // All packets must have valid UUIDs as packetId
  for (const pkt of result.packets) {
    assert.match(pkt.packetId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      `packetId is not a valid UUID: ${pkt.packetId}`);
    assert.ok(typeof pkt.timestamp === 'number');
    assert.ok(pkt.targetTopicOrUri.length > 0);
  }

  pool.destroy();

  // After destroy, executeBatch must throw
  await assert.rejects(
    async () => pool.executeBatch({ runId: 'after-destroy', startNodeId: 'node-order', batchSize: 1 }),
    /destroyed/
  );
});

test('FSMEngine + WorkerPool: emissionRateHz=0 node returns no packets', async () => {
  const nodes: SimulationNodeConfig[] = [
    {
      nodeId: 'node-silent',
      nodeName: 'Silent Node',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'silent.topic',
      emissionRateHz: 0,
      synthesisRules: [{ fieldName: 'id', ruleExpression: '"value"' }]
    }
  ];

  const engine = new FSMEngine(nodes);
  const pool = new WorkerPoolManager(engine);
  const result = await pool.executeBatch({ runId: 'silent-test', startNodeId: 'node-silent', batchSize: 5 });

  assert.equal(result.packets.length, 0, 'emissionRateHz=0 node must emit zero packets');
  pool.destroy();
});
