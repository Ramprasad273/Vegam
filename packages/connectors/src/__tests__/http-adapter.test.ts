import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { HTTPAdapter } from '../http-adapter.js';
import { EventPacket } from '@vegam/engine';

test('HTTPAdapter - connects, formats target URI, and emits batch cleanly', async () => {
  // Start local in-process test HTTP server on an ephemeral port
  let receivedHeader = '';
  let receivedBody = '';
  const server = http.createServer((req, res) => {
    receivedHeader = String(req.headers['x-vegam-signature'] || '');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      receivedBody = body;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const targetUri = `http://127.0.0.1:${port}/webhook`;

  try {
    const adapter = new HTTPAdapter();
    await adapter.connect(targetUri, { apiKey: 'secret-key-123' });

    const health = await adapter.assertHealth();
    assert.equal(health.isHealthy, true);
    assert.equal(health.protocol, 'HTTP');
    assert.equal(health.targetUri, targetUri);

    const pkt: EventPacket = {
      packetId: 'pkt-http-1',
      correlationId: 'corr-http-1',
      timestamp: Date.now(),
      nodeId: 'node-webhook',
      protocol: 'HTTP',
      targetTopicOrUri: targetUri,
      payload: { message: 'hello webhook' },
      surprisalBits: 0.5,
      isAnomaly: false,
      fieldBreakdown: {}
    };

    const result = await adapter.emitBatch([pkt]);
    assert.equal(result.success, true);
    assert.equal(result.emittedCount, 1);
    assert.ok(result.latencyMs >= 0);
    assert.ok(receivedHeader.startsWith('sha256='));
    assert.ok(receivedBody.includes('hello webhook'));

    await adapter.disconnect();
    const disconnectedHealth = await adapter.assertHealth();
    assert.equal(disconnectedHealth.isHealthy, false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

