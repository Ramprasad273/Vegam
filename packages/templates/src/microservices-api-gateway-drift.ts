import { VegamScenarioConfig } from '@vegam/engine';

/**
 * Microservices API Gateway — Drift Variant (E3 Experiment)
 *
 * Simulates a sustained downstream DB overload incident.
 * Anomaly rate jumps from 5% (nominal) to 20% (incident).
 * Launched at block index 300 in Experiment E3 to trigger the Page-Hinkley
 * online drift detector.
 */
export const MicroservicesApiGatewayDriftTemplate: VegamScenarioConfig = {
  scenarioId: 'microservices-api-gateway-drift-v1',
  scenarioName: 'Microservices API Gateway — DB Overload Incident (Drift)',
  description:
    'Drift variant of microservices-api-gateway-v1. Simulates a sustained DB overload incident with 20% anomaly rate (vs 5% nominal). Auth timeouts escalate as the Order DB cannot keep up, triggering widespread circuit breaker trips.',
  version: '1.0.0',
  concurrency: 4,
  anomalyThresholdBits: 5.5,
  chaos: {
    enabled: true,
    mode: 'latency_jitter',
    probability: 0.10,
    latencyMs: 800
  },
  nodes: [
    {
      nodeId: 'node-gateway-request-drift',
      nodeName: 'API Gateway — Ingress Router (Degraded)',
      nodeType: 'markov_fork',
      protocol: 'HTTP',
      targetTopicOrUri: 'gateway.requests.inbound',
      emissionRateHz: 150,
      markovBranches: [
        { targetNodeId: 'node-auth-ok-drift', probability: 0.80 },
        { targetNodeId: 'node-auth-timeout-drift', probability: 0.20 }
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
        }
      ]
    },
    {
      nodeId: 'node-auth-ok-drift',
      nodeName: 'Auth Service — JWT Validation OK (Slow)',
      nodeType: 'producer',
      protocol: 'HTTP',
      targetTopicOrUri: 'gateway.auth.validated',
      emissionRateHz: 120,
      synthesisRules: [
        { fieldName: 'traceId', ruleExpression: '$PREV.traceId' },
        { fieldName: 'spanId', ruleExpression: '/^[a-f0-9]{8}$/' },
        { fieldName: 'userId', ruleExpression: '/^usr_[a-z0-9]{10}$/' },
        { fieldName: 'latencyMs', ruleExpression: 'faker.number.int({min:120,max:900})' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"2024-01-15 14:32:07.468 WARN auth-svc traceId=" + $PREV.traceId + " spanId=" + $PREV.spanId + " token=VALID userId=" + $PREV.userId + " latency=" + $PREV.latencyMs + "ms status=200 SLOW_RESPONSE"'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'latencyMs',
          type: 'gaussian',
          mu: 18.0,
          sigma: 8.0,
          weight: 4.0
        }
      ]
    },
    {
      nodeId: 'node-auth-timeout-drift',
      nodeName: 'Auth Service — Timeout (Incident Rate)',
      nodeType: 'dlq_route',
      protocol: 'HTTP',
      targetTopicOrUri: 'gateway.faults.auth_timeout',
      emissionRateHz: 30,
      synthesisRules: [
        { fieldName: 'traceId', ruleExpression: '$PREV.traceId' },
        { fieldName: 'spanId', ruleExpression: '/^[a-f0-9]{8}$/' },
        { fieldName: 'latencyMs', ruleExpression: 'faker.number.int({min:5000,max:30000})' },
        { fieldName: 'retries', ruleExpression: 'faker.number.int({min:3,max:5})' },
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
    {
      nodeId: 'node-circuit-breaker-open-drift',
      nodeName: 'Circuit Breaker — OPEN (Mass Trip)',
      nodeType: 'dlq_route',
      protocol: 'HTTP',
      targetTopicOrUri: 'gateway.faults.circuit_breaker',
      emissionRateHz: 15,
      synthesisRules: [
        { fieldName: 'traceId', ruleExpression: '$PREV.traceId' },
        { fieldName: 'failureCount', ruleExpression: 'faker.number.int({min:10,max:50})' },
        { fieldName: 'cooldownMs', ruleExpression: 'faker.number.int({min:60000,max:300000})' },
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
        }
      ]
    }
  ]
};
