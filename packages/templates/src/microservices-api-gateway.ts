import { VegamScenarioConfig } from '@vegam/engine';

/**
 * Microservices API Gateway — Distributed Trace Log Template
 * NeuroLambda Stage 4 Scenario B (Zero-Shot Transfer)
 *
 * Simulates a 4-service distributed system:
 *   API Gateway → Auth Service → Product Catalog Service → Order DB
 *
 * Log format: Structured text (not JSON) that resembles real application logs.
 * Fields like trace IDs (hex), IP addresses, and timestamps trigger the
 * LogBlockParser regex masks, producing meaningful BPE token overlap with
 * the HDFS-trained MambaLog vocabulary.
 *
 * This is the zero-shot transfer scenario. MambaLog has never seen microservice
 * logs. The experiment measures how much F1 degrades without domain retraining.
 *
 * Anomaly rate: ~5% (circuit breaker trips + cascading upstream timeouts).
 *
 * FSM:
 *   [API Gateway] --95%--> [Auth OK] --> [Product Catalog OK] --> [Order DB Commit]
 *                 --5%---> [Auth Timeout] --> [Circuit Breaker Open] --> [Gateway 503]
 */
export const MicroservicesApiGatewayTemplate: VegamScenarioConfig = {
  scenarioId: 'microservices-api-gateway-v1',
  scenarioName: 'Microservices API Gateway — Distributed Trace Log & Fault Cascade',
  description:
    'Simulates a 4-service distributed microservice system: API Gateway, Auth Service, Product Catalog, and Order DB. Nominal path (95%) completes full request lifecycle. Fault path (5%) injects auth timeouts that cascade into circuit breaker trips and Gateway 503 responses. Log format is structured text for meaningful BPE vocabulary overlap with HDFS-trained MambaLog weights.',
  version: '1.0.0',
  concurrency: 4,
  anomalyThresholdBits: 5.5,
  chaos: {
    enabled: true,
    mode: 'latency_jitter',
    probability: 0.03,
    latencyMs: 250
  },
  nodes: [
    // ─── Node 1: API Gateway Ingress (Nominal Entry) ───────────────────────
    {
      nodeId: 'node-gateway-request',
      nodeName: 'API Gateway — Ingress Router',
      nodeType: 'markov_fork',
      protocol: 'HTTP',
      targetTopicOrUri: 'gateway.requests.inbound',
      emissionRateHz: 150,
      markovBranches: [
        { targetNodeId: 'node-auth-ok', probability: 0.95 },
        { targetNodeId: 'node-auth-timeout', probability: 0.05 }
      ],
      synthesisRules: [
        { fieldName: 'traceId', ruleExpression: '/^[a-f0-9]{16}$/' },
        { fieldName: 'spanId', ruleExpression: '/^[a-f0-9]{8}$/' },
        { fieldName: 'clientIp', ruleExpression: 'faker.internet.ip' },
        { fieldName: 'method', ruleExpression: 'faker.helpers.weighted([{v:"GET",w:0.60},{v:"POST",w:0.35},{v:"DELETE",w:0.05}])' },
        { fieldName: 'path', ruleExpression: 'faker.helpers.weighted([{v:"/api/v2/products",w:0.50},{v:"/api/v2/orders",w:0.35},{v:"/api/v2/users",w:0.15}])' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"2024-01-15 14:32:07.441 INFO gateway traceId=" + $PREV.traceId + " spanId=" + $PREV.spanId + " src=" + $PREV.clientIp + " " + $PREV.method + " " + $PREV.path + " routed-upstream=auth-svc"'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'method',
          type: 'categorical',
          categoricalWeights: { GET: 0.60, POST: 0.35, DELETE: 0.05 },
          weight: 1.5
        },
        {
          fieldName: 'path',
          type: 'categorical',
          categoricalWeights: {
            '/api/v2/products': 0.50,
            '/api/v2/orders': 0.35,
            '/api/v2/users': 0.15
          },
          weight: 1.0
        }
      ]
    },

    // ─── Node 2: Auth Service — Token Validation OK (Nominal) ──────────────
    {
      nodeId: 'node-auth-ok',
      nodeName: 'Auth Service — JWT Validation OK',
      nodeType: 'producer',
      protocol: 'HTTP',
      targetTopicOrUri: 'gateway.auth.validated',
      emissionRateHz: 150,
      synthesisRules: [
        { fieldName: 'traceId', ruleExpression: '$PREV.traceId' },
        { fieldName: 'spanId', ruleExpression: '/^[a-f0-9]{8}$/' },
        { fieldName: 'userId', ruleExpression: '/^usr_[a-z0-9]{10}$/' },
        { fieldName: 'latencyMs', ruleExpression: 'faker.number.int({min:2,max:45})' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"2024-01-15 14:32:07.468 INFO auth-svc traceId=" + $PREV.traceId + " spanId=" + $PREV.spanId + " token=VALID userId=" + $PREV.userId + " latency=" + $PREV.latencyMs + "ms status=200"'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'latencyMs',
          type: 'gaussian',
          mu: 18.0,
          sigma: 8.0,
          weight: 1.5
        }
      ]
    },

    // ─── Node 3: Product Catalog — Cache Hit (Nominal) ─────────────────────
    {
      nodeId: 'node-product-svc-ok',
      nodeName: 'Product Catalog — Cache Hit OK',
      nodeType: 'producer',
      protocol: 'HTTP',
      targetTopicOrUri: 'gateway.product.response',
      emissionRateHz: 150,
      synthesisRules: [
        { fieldName: 'traceId', ruleExpression: '$PREV.traceId' },
        { fieldName: 'spanId', ruleExpression: '/^[a-f0-9]{8}$/' },
        { fieldName: 'cacheStatus', ruleExpression: 'faker.helpers.weighted([{v:"HIT",w:0.85},{v:"MISS",w:0.15}])' },
        { fieldName: 'itemCount', ruleExpression: 'faker.number.int({min:1,max:50})' },
        { fieldName: 'latencyMs', ruleExpression: 'faker.number.int({min:1,max:25})' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"2024-01-15 14:32:07.479 INFO product-svc traceId=" + $PREV.traceId + " spanId=" + $PREV.spanId + " cache=" + $PREV.cacheStatus + " items=" + $PREV.itemCount + " latency=" + $PREV.latencyMs + "ms status=200"'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'cacheStatus',
          type: 'categorical',
          categoricalWeights: { HIT: 0.85, MISS: 0.15 },
          weight: 1.5
        },
        {
          fieldName: 'latencyMs',
          type: 'gaussian',
          mu: 10.0,
          sigma: 5.0,
          weight: 1.0
        }
      ]
    },

    // ─── Node 4: Order DB Commit — Write Success (Nominal) ─────────────────
    {
      nodeId: 'node-order-commit-ok',
      nodeName: 'Order DB — Commit Success',
      nodeType: 'producer',
      protocol: 'HTTP',
      targetTopicOrUri: 'gateway.order.committed',
      emissionRateHz: 60,
      synthesisRules: [
        { fieldName: 'traceId', ruleExpression: '$PREV.traceId' },
        { fieldName: 'orderId', ruleExpression: '/^ord_[a-z0-9]{12}$/' },
        { fieldName: 'latencyMs', ruleExpression: 'faker.number.int({min:5,max:80})' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"2024-01-15 14:32:07.512 INFO order-db traceId=" + $PREV.traceId + " orderId=" + $PREV.orderId + " txn=COMMIT rows=1 latency=" + $PREV.latencyMs + "ms status=201"'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'latencyMs',
          type: 'gaussian',
          mu: 35.0,
          sigma: 15.0,
          weight: 1.5
        }
      ]
    },

    // ─── Node 5: Auth Service Timeout (FAULT — High Surprisal) ─────────────
    {
      nodeId: 'node-auth-timeout',
      nodeName: 'Auth Service — Upstream Timeout',
      nodeType: 'dlq_route',
      protocol: 'HTTP',
      targetTopicOrUri: 'gateway.faults.auth_timeout',
      emissionRateHz: 8,
      synthesisRules: [
        { fieldName: 'traceId', ruleExpression: '$PREV.traceId' },
        { fieldName: 'spanId', ruleExpression: '/^[a-f0-9]{8}$/' },
        { fieldName: 'latencyMs', ruleExpression: 'faker.number.int({min:3000,max:9000})' },
        { fieldName: 'retries', ruleExpression: 'faker.number.int({min:1,max:3})' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"2024-01-15 14:32:10.461 ERROR gateway traceId=" + $PREV.traceId + " spanId=" + $PREV.spanId + " upstream=auth-svc timeout after " + $PREV.latencyMs + "ms status=504 retries=" + $PREV.retries'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'latencyMs',
          type: 'gaussian',
          mu: 18.0,
          sigma: 8.0,
          weight: 5.0
        },
        {
          fieldName: 'retries',
          type: 'gaussian',
          mu: 0.0,
          sigma: 0.1,
          weight: 3.0
        }
      ]
    },

    // ─── Node 6: Circuit Breaker OPEN (FAULT — Very High Surprisal) ────────
    {
      nodeId: 'node-circuit-breaker-open',
      nodeName: 'Circuit Breaker — OPEN State Triggered',
      nodeType: 'dlq_route',
      protocol: 'HTTP',
      targetTopicOrUri: 'gateway.faults.circuit_breaker',
      emissionRateHz: 4,
      synthesisRules: [
        { fieldName: 'traceId', ruleExpression: '$PREV.traceId' },
        { fieldName: 'failureCount', ruleExpression: 'faker.number.int({min:5,max:15})' },
        { fieldName: 'cooldownMs', ruleExpression: 'faker.number.int({min:30000,max:60000})' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"2024-01-15 14:32:10.463 ERROR circuit-breaker traceId=" + $PREV.traceId + " service=auth-svc state=OPEN failures=" + $PREV.failureCount + " cooldown=" + $PREV.cooldownMs + "ms"'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'failureCount',
          type: 'gaussian',
          mu: 0.0,
          sigma: 0.1,
          weight: 6.0
        },
        {
          fieldName: 'log_line',
          type: 'categorical',
          categoricalWeights: { 'state=OPEN': 0.005 },
          weight: 4.5
        }
      ]
    },

    // ─── Node 7: Gateway 503 Cascade (FAULT — Highest Surprisal) ───────────
    {
      nodeId: 'node-gateway-503-cascade',
      nodeName: 'API Gateway — 503 Service Unavailable Cascade',
      nodeType: 'dlq_route',
      protocol: 'HTTP',
      targetTopicOrUri: 'gateway.faults.503_cascade',
      emissionRateHz: 2,
      synthesisRules: [
        { fieldName: 'traceId', ruleExpression: '$PREV.traceId' },
        { fieldName: 'affectedRoutes', ruleExpression: 'faker.number.int({min:3,max:12})' },
        { fieldName: 'clientIp', ruleExpression: '$PREV.clientIp' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"2024-01-15 14:32:10.465 CRITICAL gateway traceId=" + $PREV.traceId + " 503 ServiceUnavailable circuit=OPEN affected_routes=" + $PREV.affectedRoutes + " client=" + $PREV.clientIp'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'affectedRoutes',
          type: 'gaussian',
          mu: 0.0,
          sigma: 0.1,
          weight: 7.0
        },
        {
          fieldName: 'log_line',
          type: 'categorical',
          categoricalWeights: { 'ServiceUnavailable': 0.003 },
          weight: 5.0
        }
      ]
    }
  ]
};
