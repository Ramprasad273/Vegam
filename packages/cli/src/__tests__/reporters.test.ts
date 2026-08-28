import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SARIFReporter } from '../reporters/sarif-reporter.js';
import { JUnitReporter } from '../reporters/junit-reporter.js';
import { EventPacket } from '@vegam/engine';

test('SARIFReporter and JUnitReporter - generate valid report files with accurate anomalies and exact latency', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vegam-test-'));
  const sarifPath = path.join(tmpDir, 'report.sarif');
  const junitPath = path.join(tmpDir, 'report.xml');

  const packets: EventPacket[] = [
    {
      packetId: 'pkt-1',
      correlationId: 'corr-1',
      timestamp: Date.now(),
      nodeId: 'node-login',
      protocol: 'KAFKA',
      targetTopicOrUri: 'auth.events',
      payload: { user: 'alice' },
      surprisalBits: 1.2,
      isAnomaly: false,
      fieldBreakdown: {},
      executionLatencyMs: 0.25
    },
    {
      packetId: 'pkt-2',
      correlationId: 'corr-2',
      timestamp: Date.now(),
      nodeId: 'node-payment',
      protocol: 'KAFKA',
      targetTopicOrUri: 'payment.events',
      payload: { amount: 999999 },
      surprisalBits: 9.5,
      isAnomaly: true,
      fieldBreakdown: { amount: { probability: 0.0001, surprisalBits: 9.5 } },
      executionLatencyMs: 1.15
    }
  ];

  await SARIFReporter.generateReport('run-abc', 'test-scenario', packets, sarifPath);
  const sarifRaw = await fs.readFile(sarifPath, 'utf8');
  const sarifJson = JSON.parse(sarifRaw);
  assert.equal(sarifJson.version, '2.1.0');
  assert.equal(sarifJson.runs[0].results.length, 1);
  assert.equal(sarifJson.runs[0].results[0].properties.surprisalBits, 9.5);

  await JUnitReporter.generateReport('run-abc', 'test-scenario', packets, junitPath);
  const junitRaw = await fs.readFile(junitPath, 'utf8');
  assert.ok(junitRaw.includes('<testsuites name="Vegam Surprisal Verification"'));
  assert.ok(junitRaw.includes('failures="1"'));
  assert.ok(junitRaw.includes('High Surprisal Anomaly Detected'));

  await fs.rm(tmpDir, { recursive: true, force: true });
});
