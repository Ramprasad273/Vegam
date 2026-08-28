# Vegam API & SDK Reference Documentation

Vegam can be used in three ways: as a **TypeScript/Node.js SDK (`@vegam/engine`)**, via the **Headless CLI (`@vegam/cli`)**, or via the **Studio REST API (`@vegam/studio`)**.


## 1. TypeScript SDK (`@vegam/engine`)

Install the core simulation engine in your Node.js or TypeScript application:

```bash
npm install @vegam/engine
```

### Core Classes & Methods

#### `FSMEngine`
The stateful Markov Finite State Machine (FSM) engine responsible for executing node transitions, synthesizing fields, and propagating correlation variables.

```typescript
import { FSMEngine, SimulationNodeConfig, EventPacket } from '@vegam/engine';

const nodes: SimulationNodeConfig[] = [
  {
    nodeId: 'gateway-order',
    nodeName: 'Order Gateway',
    nodeType: 'producer',
    protocol: 'KAFKA',
    targetTopicOrUri: 'orders.raw',
    synthesisRules: [
      { fieldName: 'orderId', ruleExpression: '/^ORD-[0-9]{4}$/' },
      { fieldName: 'amountUsd', ruleExpression: 'faker.number.float({min:10,max:500,fractionDigits:2})' }
    ]
  }
];

const engine = new FSMEngine(nodes);

// Step a specific node (optionally passing parent packet for correlation $PREV variables)
const result = engine.stepNode('gateway-order');
console.log(result.packet.payload); // { orderId: 'ORD-4821', amountUsd: 145.50 }
console.log(result.packet.executionLatencyMs); // e.g. 0.42 ms
```

#### `SurprisalEngine`
Computes anomaly scores across wire payload fields to detect statistically anomalous events.

```typescript
import { SurprisalEngine, FieldSurprisalRule } from '@vegam/engine';

const surprisal = new SurprisalEngine(6.0); // Anomaly threshold = 6.0 bits
const rules: FieldSurprisalRule[] = [
  {
    fieldName: 'status',
    type: 'categorical',
    categoricalWeights: { OK: 0.98, CRITICAL_ERROR: 0.02 },
    weight: 1.0
  }
];

const score = surprisal.scorePacket({ status: 'CRITICAL_ERROR' }, rules);
console.log(score.totalSurprisalBits); // 5.64 bits
console.log(score.isAnomaly); // true (when combined with other low-probability fields)
```

#### `InMemoryTelemetryStore`
High-speed columnar ring buffer backed by `TypedArrays` (`Float64Array`, `Int32Array`) for zero-copy aggregation of throughput, p50/p95/p99 latencies, and Shannon entropy over time.

```typescript
import { InMemoryTelemetryStore } from '@vegam/engine';

const store = new InMemoryTelemetryStore(100_000); // 100k event ring buffer capacity
store.flushBatch('run-101', [result.packet]);

const buckets = store.queryTimeBuckets('run-101', 30); // Get last 30 seconds of aggregations
console.log(buckets[0]?.p95Latency);
```


## 2. Studio REST API (`/api/simulate`)

When running `@vegam/studio` (`npm run dev`), the Next.js backend exposes REST endpoints for triggering test simulations, inspecting health, querying quota metrics, and executing verification runs.

### `POST /api/simulate`
Launches or steps an FSM simulation using worker batches and returns real-time latency and anomaly telemetry.

**Request Body:**
```json
{
  "scenarioId": "ecommerce-checkout-v1",
  "rateHz": 100,
  "durationSec": 3,
  "activeConnection": {
    "protocol": "KAFKA",
    "bootstrapServers": "localhost:19092"
  }
}
```

**Response:**
```json
{
  "success": true,
  "runId": "run-1718000000000",
  "elapsedMs": 3012,
  "actualThroughputHz": 100,
  "avgEntropyBits": 0.142,
  "totalEventsGenerated": 300,
  "anomalyCount": 4,
  "timeBuckets": [...],
  "quotaStatus": {
    "consumedBytes": 45120,
    "maxBytes": 524288000,
    "isExhausted": false
  },
  "recentPackets": [...]
}
```

### `GET /api/simulate`
Returns current operational status, governor enforcement mode, and daily egress quota status.

### `POST /api/health`
Tests connectivity to a designated broker URI while enforcing SSRF protection and outbound port whitelisting.

**Request Body:**
```json
{
  "protocol": "KAFKA",
  "uri": "localhost:19092"
}
```

### `GET /api/test-runner`
Executes the in-process verification test suite across all `@vegam/engine`, `@vegam/connectors`, and `@vegam/templates` modules. When hosted with `VEGAM_GOVERNOR_ENABLED=true`, requires the `x-vegam-health-token` header matching the server's configured secret.


## 3. Headless CLI (`@vegam/cli`)

Run stateful simulations or export static audit logs directly from your terminal or CI/CD pipelines:

```bash
# Run a scenario at 500 Hz for 10 seconds
node packages/cli/dist/cli.js run --template ecommerce-checkout-v1 --rate 500 --duration 10

# Export SARIF v2.1.0 audit report for GitHub Security CodeQL integration
node packages/cli/dist/cli.js export --template fintech-fraud-surprisal-v1 --output report.sarif --format sarif

# Export JUnit XML report for automated CI/CD gating
node packages/cli/dist/cli.js export --template iot-fleet-telemetry-v1 --output TEST-vegam.xml --format junit
```
