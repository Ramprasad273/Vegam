import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentGrader } from '../simulation/agent-grader.js';

test('AgentGrader - grade successful mitigation of high-surprisal anomaly', () => {
  const report = AgentGrader.gradeMitigation(7.5, { decision: 'Route to DLQ and Block Fraud', latencyMs: 12 });
  assert.equal(report.mitigationSuccess, true);
  assert.equal(report.hallucinationScore, 0.0);
  assert.equal(report.sarifRule, 'VEGAM-SEC-001');
  assert.ok(report.gradeSummary.includes('PASS'));
});

test('AgentGrader - grade agent hallucination/failure when ignoring high-surprisal anomaly', () => {
  const report = AgentGrader.gradeMitigation(8.2, { decision: 'Confirm Order and Proceed', latencyMs: 45 });
  assert.equal(report.mitigationSuccess, false);
  assert.ok(report.hallucinationScore > 0.8);
  assert.equal(report.sarifRule, 'VEGAM-AI-HALLUCINATION-001');
  assert.ok(report.gradeSummary.includes('FAIL'));
});

test('AgentGrader - grade false-positive mitigation on normal low-surprisal packet', () => {
  const report = AgentGrader.gradeMitigation(2.1, { decision: 'Trigger DLQ Alert', latencyMs: 10 });
  assert.equal(report.mitigationSuccess, false);
  assert.equal(report.hallucinationScore, 0.5);
  assert.equal(report.sarifRule, 'VEGAM-AI-FALSE-POSITIVE-001');
  assert.ok(report.gradeSummary.includes('WARN'));
});
