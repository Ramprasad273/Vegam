import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_TEMPLATES, getTemplateById } from '../index.js';
import { FSMEngine, SimulationNodeSchema } from '@vegam/engine';

test('Templates - all pre-packaged templates conform to SimulationNodeSchema and can be initialized in FSMEngine', () => {
  assert.equal(ALL_TEMPLATES.length, 8);

  for (const template of ALL_TEMPLATES) {
    assert.ok(template.scenarioId, 'Template must have scenarioId');
    assert.ok(template.nodes.length > 0, `Template ${template.scenarioId} must have at least one node`);

    for (const node of template.nodes) {
      // Validate node through Zod schema
      const parsed = SimulationNodeSchema.parse(node);
      assert.equal(parsed.nodeId, node.nodeId);
    }

    // Initialize in FSMEngine
    const engine = new FSMEngine(template.nodes, template.anomalyThresholdBits);
    const firstNode = template.nodes[0];
    if (firstNode) {
      const stepResult = engine.stepNode(firstNode.nodeId);
      assert.ok(stepResult.packet);
      assert.ok(stepResult.packet.packetId);
      assert.equal(typeof stepResult.packet.surprisalBits, 'number');
    }
  }
});

test('getTemplateById - retrieves exact or fuzzy matched templates cleanly', () => {
  const ecommerce = getTemplateById('ecommerce-checkout-v1');
  assert.ok(ecommerce);
  assert.equal(ecommerce?.scenarioId, 'ecommerce-checkout-v1');

  const fintech = getTemplateById('fintech');
  assert.ok(fintech);
  assert.equal(fintech?.scenarioId, 'fintech-fraud-surprisal-v1');

  const hdfs = getTemplateById('hdfs-distributed-syslog-v1');
  assert.ok(hdfs);
  assert.equal(hdfs?.scenarioId, 'hdfs-distributed-syslog-v1');
});
