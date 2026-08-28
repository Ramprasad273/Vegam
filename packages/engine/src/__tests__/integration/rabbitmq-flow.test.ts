import test from 'node:test';
import assert from 'node:assert/strict';
import { FSMEngine, SimulationNodeConfig } from '../../simulation/fsm-engine.js';

test('FSMEngine AMQP node stepping generates valid AMQP packets', () => {
  const nodes: SimulationNodeConfig[] = [
    {
      nodeId: 'n1',
      nodeName: 'RabbitMQ Producer',
      nodeType: 'producer',
      protocol: 'AMQP',
      emissionRateHz: 10,
      targetTopicOrUri: 'orders.queue',
      synthesisRules: [
        { fieldName: 'orderId', ruleExpression: 'uuid()' },
        { fieldName: 'status', ruleExpression: '"QUEUED"' }
      ]
    }
  ];

  const engine = new FSMEngine(nodes);
  const stepResult = engine.stepNode('n1');

  assert.ok(stepResult.packet);
  assert.equal(stepResult.packet.protocol, 'AMQP');
  assert.equal(stepResult.packet.targetTopicOrUri, 'orders.queue');
  assert.equal(stepResult.packet.payload['status'], 'QUEUED');
});

