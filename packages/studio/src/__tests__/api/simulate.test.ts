import test from 'node:test';
import assert from 'node:assert/strict';
import { POST, GET } from '../../app/api/simulate/route.js';

test('/api/simulate GET returns operational status', async () => {
  const req = new Request('http://localhost/api/simulate', { method: 'GET' });
  const res = await GET(req as any);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.status, 'operational');
});

test('/api/simulate POST executes simulation for template scenario', async () => {
  const req = new Request('http://localhost/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenarioId: 'ecommerce-checkout-v1',
      rateHz: 10,
      durationSec: 1
    })
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.runId);
  assert.ok(Array.isArray(json.recentPackets));
  assert.ok(json.recentPackets.length > 0);
});

