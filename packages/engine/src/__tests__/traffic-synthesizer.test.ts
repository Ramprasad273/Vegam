import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrafficSynthesizer } from '../simulation/traffic-synthesizer.js';

test('TrafficSynthesizer - synthesize stateful YAML from sample packets with $PREV correlation and markov_fork', () => {
  const samples = [
    { orderId: 'ord_9001', customerEmail: 'test@vegam.io', amountUsd: 250.0, isVip: true },
    { orderId: 'ord_9002', customerEmail: 'fraud@vegam.io', amountUsd: 9999.0, isVip: false }
  ];

  const yaml = TrafficSynthesizer.synthesizeYaml('AutoCapturedOrderFlow', samples);

  assert.ok(yaml.includes('name: AutoCapturedOrderFlow'));
  assert.ok(yaml.includes('orderId: "$PREV.orderId"'));
  assert.ok(yaml.includes('amountUsd: 250'));
  assert.ok(yaml.includes('markov_fork:'));
  assert.ok(yaml.includes('probability: 0.90'));
});

test('TrafficSynthesizer - handle empty packets array gracefully', () => {
  const yaml = TrafficSynthesizer.synthesizeYaml('EmptyFlow', []);
  assert.ok(yaml.includes('nodes: []'));
});
