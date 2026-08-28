import test from 'node:test';
import assert from 'node:assert/strict';
import { SurprisalEngine, FieldSurprisalRule } from '../simulation/surprisal-engine.js';

test('SurprisalEngine - computes exact self-information I(x) for categorical probabilities', () => {
  const engine = new SurprisalEngine(6.0);
  const rules: FieldSurprisalRule[] = [
    {
      fieldName: 'currency',
      type: 'categorical',
      categoricalWeights: { USD: 0.8, EUR: 0.15, JPY: 0.05 },
      weight: 1.0
    }
  ];

  // For USD (prob = 0.8): -log2(0.8) approx 0.3219 bits
  const scoreUsd = engine.scorePacket({ currency: 'USD' }, rules);
  assert.equal(scoreUsd.isAnomaly, false);
  assert.ok(Math.abs(scoreUsd.totalSurprisalBits - 0.3219) < 0.01, `Expected ~0.3219, got ${scoreUsd.totalSurprisalBits}`);
  assert.equal(scoreUsd.fieldBreakdown['currency']?.probability, 0.8);

  // For JPY (prob = 0.05): -log2(0.05) approx 4.3219 bits
  const scoreJpy = engine.scorePacket({ currency: 'JPY' }, rules);
  assert.equal(scoreJpy.isAnomaly, false);
  assert.ok(Math.abs(scoreJpy.totalSurprisalBits - 4.3219) < 0.01, `Expected ~4.3219, got ${scoreJpy.totalSurprisalBits}`);
  assert.equal(scoreJpy.fieldBreakdown['currency']?.probability, 0.05);
});

test('SurprisalEngine - detects anomalies when total surprisal exceeds anomalyThresholdBits', () => {
  const engine = new SurprisalEngine(4.0); // Set threshold to 4.0 bits
  const rules: FieldSurprisalRule[] = [
    {
      fieldName: 'status',
      type: 'categorical',
      categoricalWeights: { OK: 0.99, CRITICAL_ERR: 0.005 },
      weight: 1.0
    }
  ];

  // CRITICAL_ERR (prob = 0.005): -log2(0.005) approx 7.64 bits -> exceeds threshold 4.0
  const scoreErr = engine.scorePacket({ status: 'CRITICAL_ERR' }, rules);
  assert.equal(scoreErr.isAnomaly, true);
  assert.ok(scoreErr.totalSurprisalBits > 4.0);
});

test('SurprisalEngine - tracks running average Shannon Entropy H(X)', () => {
  const engine = new SurprisalEngine(6.0);
  const rules: FieldSurprisalRule[] = [
    { fieldName: 'coin', type: 'categorical', categoricalWeights: { HEADS: 0.5, TAILS: 0.5 } }
  ];

  engine.scorePacket({ coin: 'HEADS' }, rules); // 1.0 bit
  engine.scorePacket({ coin: 'TAILS' }, rules); // 1.0 bit
  assert.equal(engine.getShannonEntropy(), 1.0);
});

test('SurprisalEngine - computes exact KL Divergence D(P || Q)', () => {
  const p = [0.5, 0.5];
  const q = [0.25, 0.75];
  // KL = 0.5 * log2(0.5/0.25) + 0.5 * log2(0.5/0.75) = 0.5 * 1 + 0.5 * (-0.58496) = 0.5 - 0.29248 = 0.2075 bits
  const kl = SurprisalEngine.computeKLDivergence(p, q);
  assert.ok(Math.abs(kl - 0.2075) < 0.01, `Expected ~0.2075, got ${kl}`);
});

test('SurprisalEngine - evaluates Gaussian probability distributions', () => {
  const engine = new SurprisalEngine(6.0);
  const rules: FieldSurprisalRule[] = [
    { fieldName: 'latency', type: 'gaussian', mu: 100, sigma: 10, weight: 1.0 }
  ];

  // At mu (100), probability density bucket is highest, surprisal is low
  const scoreNormal = engine.scorePacket({ latency: 100 }, rules);
  // At 150 (5 sigma away), probability is extremely small, surprisal is very high
  const scoreExtreme = engine.scorePacket({ latency: 150 }, rules);

  assert.ok(scoreNormal.totalSurprisalBits < scoreExtreme.totalSurprisalBits);
});
