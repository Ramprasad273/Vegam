import test from 'node:test';
import assert from 'node:assert/strict';
import { FSMEngine, SimulationNodeConfig } from '../simulation/fsm-engine.js';

test('FSMEngine.stepNode: throws on unknown nodeId', () => {
  const engine = new FSMEngine([
    {
      nodeId: 'node-a',
      nodeName: 'Node A',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'topic.a',
      synthesisRules: [{ fieldName: 'id', ruleExpression: '"val"' }]
    }
  ]);

  assert.throws(
    () => engine.stepNode('nonexistent-node'),
    /Unknown node ID requested/
  );
});

test('FSMEngine.stepNode: returns null packet when emissionRateHz is 0', () => {
  const engine = new FSMEngine([
    {
      nodeId: 'node-silent',
      nodeName: 'Silent',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'silent.topic',
      emissionRateHz: 0,
      synthesisRules: [{ fieldName: 'id', ruleExpression: '"x"' }]
    }
  ]);

  const result = engine.stepNode('node-silent');
  assert.equal(result.packet, null, 'emissionRateHz=0 must return null packet');
});

test('FSMEngine.stepNode: $PREV.nonexistent falls back to uuid', () => {
  const engine = new FSMEngine([
    {
      nodeId: 'node-b',
      nodeName: 'Node B',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'topic.b',
      synthesisRules: [{ fieldName: 'missing', ruleExpression: '$PREV.fieldThatDoesNotExist' }]
    }
  ]);

  // No parent packet — $PREV.x should fall back without throwing
  const result = engine.stepNode('node-b');
  assert.ok(result.packet, 'Should produce a packet even when $PREV field is missing');
  // The fallback is a uuid string
  assert.equal(typeof result.packet.payload['missing'], 'string');
});

test('FSMEngine: Markov branches with probabilities summing to < 1.0 throws validation error', () => {
  assert.throws(
    () => new FSMEngine([
      {
        nodeId: 'node-fork',
        nodeName: 'Fork',
        nodeType: 'markov_fork',
        protocol: 'KAFKA',
        targetTopicOrUri: 'fork.topic',
        synthesisRules: [{ fieldName: 'id', ruleExpression: '"v"' }],
        markovBranches: [
          { targetNodeId: 'node-a', probability: 0.4 },
          { targetNodeId: 'node-b', probability: 0.3 }
        ]
      }
    ]),
    /Markov branch probabilities must sum to 1.0/
  );
});

test('FSMEngine: sequential node linking works when no markovBranches defined', () => {
  const nodes: SimulationNodeConfig[] = [
    {
      nodeId: 'node-first',
      nodeName: 'First',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'first.topic',
      synthesisRules: [{ fieldName: 'id', ruleExpression: '"a"' }]
    },
    {
      nodeId: 'node-second',
      nodeName: 'Second',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'second.topic',
      synthesisRules: [{ fieldName: 'id', ruleExpression: '"b"' }]
    }
  ];

  const engine = new FSMEngine(nodes);
  const result = engine.stepNode('node-first');
  assert.equal(result.nextNodeId, 'node-second', 'Should implicitly link to next node in sequence');
});
