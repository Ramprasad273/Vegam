import test from 'node:test';
import assert from 'node:assert/strict';
import { FSMEngine, SimulationNodeConfig, EventPacket } from '../simulation/fsm-engine.js';

test('FSMEngine - steps node and generates valid EventPacket with executionLatencyMs', () => {
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
  assert.equal(result.packet.targetTopicOrUri, 'events.raw');
  assert.equal(result.packet.payload['orderId'], 'ORD-101');
  assert.equal(result.packet.payload['status'], 'NEW');
  assert.equal(typeof result.packet.executionLatencyMs, 'number');
  assert.ok((result.packet.executionLatencyMs ?? -1) >= 0);
});

test('FSMEngine - propagates correlationId and $PREV variables from parentPacket', () => {
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
    payload: { orderId: 'ORD-5555', customerId: 'CUST-1' },
    surprisalBits: 1.0,
    isAnomaly: false,
    fieldBreakdown: {}
  };

  const result = engine.stepNode('node-downstream', parentPacket);

  assert.ok(result.packet);
  assert.equal(result.packet.correlationId, 'corr-xyz-999');
  assert.equal(result.packet.payload['orderId'], 'ORD-5555');
  assert.equal(result.packet.payload['status'], 'CONFIRMED');
});

test('FSMEngine - selects next Markov branch based on probability distribution', () => {
  const nodes: SimulationNodeConfig[] = [
    {
      nodeId: 'node-fork',
      nodeName: 'Markov Fork Node',
      nodeType: 'markov_fork',
      protocol: 'KAFKA',
      targetTopicOrUri: 'events.fork',
      markovBranches: [
        { targetNodeId: 'node-success', probability: 1.0 },
        { targetNodeId: 'node-fail', probability: 0.0 }
      ]
    }
  ];

  const engine = new FSMEngine(nodes);
  const result = engine.stepNode('node-fork');

  assert.equal(result.nextNodeId, 'node-success');
});

test('FSMEngine - rejects markovBranches whose probabilities do not sum to 1.0', () => {
  const invalidNodes: SimulationNodeConfig[] = [
    {
      nodeId: 'node-bad-fork',
      nodeName: 'Bad Fork Node',
      nodeType: 'markov_fork',
      protocol: 'KAFKA',
      targetTopicOrUri: 'events.fork',
      markovBranches: [
        { targetNodeId: 'node-a', probability: 0.3 },
        { targetNodeId: 'node-b', probability: 0.3 }
      ]
    }
  ];

  assert.throws(() => new FSMEngine(invalidNodes), /Markov branch probabilities must sum to 1.0/);
});
