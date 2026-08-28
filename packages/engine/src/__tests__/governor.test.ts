import test from 'node:test';
import assert from 'node:assert/strict';
import { SSRFGuard, SecurityViolationException, isInternalOrRestrictedIP } from '../governor/ssrf-guard.js';
import { RuntimeLimiter } from '../governor/runtime-limiter.js';

test('SSRFGuard - correctly identifies internal, restricted, and cloud metadata IP ranges', () => {
  assert.equal(isInternalOrRestrictedIP('127.0.0.1'), true);
  assert.equal(isInternalOrRestrictedIP('0.0.0.0'), true);
  assert.equal(isInternalOrRestrictedIP('169.254.169.254'), true); // Cloud metadata
  assert.equal(isInternalOrRestrictedIP('10.0.0.1'), true); // RFC 1918
  assert.equal(isInternalOrRestrictedIP('192.168.1.100'), true); // RFC 1918
  assert.equal(isInternalOrRestrictedIP('172.16.0.1'), true); // RFC 1918
  assert.equal(isInternalOrRestrictedIP('8.8.8.8'), false); // Public DNS
});

test('SSRFGuard - blocks connections when governor is enabled for private IPs', async () => {
  SSRFGuard._setGovernorForTests(true);
  try {
    await assert.rejects(
      async () => await SSRFGuard.assertSafeTarget('kafka://169.254.169.254:9092'),
      /SecurityViolationException/
    );
    await assert.rejects(
      async () => await SSRFGuard.assertSafeTarget('10.0.0.5:5672'),
      /SecurityViolationException/
    );
  } finally {
    SSRFGuard._setGovernorForTests(false);
  }
});

test('RuntimeLimiter - clamps emission rate and checks payload size', () => {
  RuntimeLimiter._setGovernorForTests(true);
  try {
    const clamped = RuntimeLimiter.clampEmissionRate(500);
    assert.ok(clamped <= 100, `Expected clamped rate <= 100 when governor enabled, got ${clamped}`);

    assert.throws(
      () => RuntimeLimiter.assertPayloadSize(100_000), // Exceeds 16KB limit in governor mode
      /exceeds Governor cap/
    );
  } finally {
    RuntimeLimiter._setGovernorForTests(false);
  }
});
