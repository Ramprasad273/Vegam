import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkerPoolManager } from '../simulation/worker-pool.js';
import { FSMEngine, SimulationNodeConfig } from '../simulation/fsm-engine.js';

test('WorkerPoolManager - executes batch and returns valid packets and duration', async () => {
  const nodes: SimulationNodeConfig[] = [
    {
      nodeId: 'node-worker-test',
      nodeName: 'Worker Node',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'worker.topic',
      synthesisRules: [
        { fieldName: 'id', ruleExpression: 'faker.string.uuid()' }
      ]
    }
  ];

  const engine = new FSMEngine(nodes);
  const pool = new WorkerPoolManager(engine);

  const result = await pool.executeBatch({
    runId: 'run-worker-1',
    startNodeId: 'node-worker-test',
    batchSize: 10
  });

  assert.equal(result.packets.length, 10);
  assert.ok(result.durationMs >= 0);
  assert.equal(typeof result.anomalyCount, 'number');

  pool.destroy();
  await assert.rejects(
    async () => await pool.executeBatch({ runId: 'run-worker-2', startNodeId: 'node-worker-test', batchSize: 5 }),
    /Pool has been destroyed/
  );
});
