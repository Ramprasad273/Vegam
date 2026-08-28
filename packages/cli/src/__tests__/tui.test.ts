import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeTuiCommand } from '../commands/tui.js';

test('executeTuiCommand - run live terminal dashboard for specified duration and report stats', async () => {
  const res = await executeTuiCommand({
    template: 'fintech-fraud-surprisal-v1',
    rate: 100,
    duration: 1
  });

  assert.ok(res.totalEvents > 0);
  assert.ok(typeof res.anomalies === 'number');
});
