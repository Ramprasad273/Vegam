import { test, expect } from '@playwright/test';

test.describe('/api/simulate API Route', () => {
  test('should default to ecommerce template if no scenario is provided', async ({ request }) => {
    const res = await request.post('/api/simulate', {
      data: {}
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.totalEventsGenerated).toBeGreaterThanOrEqual(0);
  });

  test('should run simulation and return telemetry packets for valid topology', async ({ request }) => {
    const payload = {
      scenarioConfig: {
        scenarioId: 'test-scenario',
        scenarioName: 'Test Scenario',
        anomalyThresholdBits: 6.0,
        concurrency: 1,
        nodes: [
          {
            nodeId: 'node-1',
            nodeName: 'Test Node',
            nodeType: 'producer',
            protocol: 'KAFKA',
            targetTopicOrUri: 'test.topic',
            emissionRateHz: 10,
            synthesisRules: [
              { fieldName: 'id', ruleExpression: '"123"' }
            ]
          }
        ]
      },
      rateHz: 10,
      durationSec: 1,
      governorEnabled: false
    };

    const res = await request.post('/api/simulate', {
      data: payload
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.totalEventsGenerated).toBeGreaterThan(0);
    expect(Array.isArray(json.recentPackets)).toBe(true);
  });
});
