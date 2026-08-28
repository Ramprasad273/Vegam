import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { executeCaptureCommand } from '../commands/capture.js';

test('executeCaptureCommand - read JSON samples from disk and synthesize stateful YAML', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vegam-capture-test-'));
  const inputPath = path.join(tmpDir, 'samples.json');
  const outputPath = path.join(tmpDir, 'out.yaml');

  const sampleData = [
    { orderId: 'ord_101', customerId: 'cust_abc', amountUsd: 120.5 },
    { orderId: 'ord_102', customerId: 'cust_xyz', amountUsd: 4500.0 }
  ];
  fs.writeFileSync(inputPath, JSON.stringify(sampleData), 'utf8');

  const yaml = await executeCaptureCommand({
    input: inputPath,
    output: outputPath,
    name: 'TestCaptureScenario'
  });

  assert.ok(yaml.includes('name: TestCaptureScenario'));
  assert.ok(yaml.includes('orderId: "$PREV.orderId"'));
  assert.ok(fs.existsSync(outputPath));

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
