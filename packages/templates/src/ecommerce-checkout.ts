import { VegamScenarioConfig } from '@vegam/engine';

export const ECommerceCheckoutTemplate: VegamScenarioConfig = {
  scenarioId: 'ecommerce-checkout-v1',
  scenarioName: 'E-Commerce Checkout & Markov Order State Flow',
  description: 'Simulates high-throughput online shopping orders with Markov branching: 92% successful checkout -> OrderShipped, 8% payment failure -> DLQ/Fraud check.',
  version: '1.0.0',
  concurrency: 4,
  anomalyThresholdBits: 6.0,
  chaos: {
    enabled: true,
    mode: 'latency_jitter',
    probability: 0.05,
    latencyMs: 350
  },
  nodes: [
    {
      nodeId: 'node-order-placed',
      nodeName: 'Order Placed Gateway',
      nodeType: 'markov_fork',
      protocol: 'KAFKA',
      targetTopicOrUri: 'orders.raw',
      emissionRateHz: 50,
      markovBranches: [
        { targetNodeId: 'node-order-shipped', probability: 0.92 },
        { targetNodeId: 'node-payment-failed', probability: 0.08 }
      ],
      synthesisRules: [
        { fieldName: 'orderId', ruleExpression: 'faker.string.uuid()' },
        { fieldName: 'customerId', ruleExpression: '$CUSTOMER_POOL[rand]' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        { fieldName: 'amountUsd', ruleExpression: 'faker.number.float({min:15,max:1200,fractionDigits:2})' },
        { fieldName: 'currency', ruleExpression: 'faker.helpers.weighted([{v:"USD",w:0.8},{v:"EUR",w:0.15},{v:"JPY",w:0.05}])' },
        { fieldName: 'itemCategory', ruleExpression: 'faker.helpers.weighted([{v:"electronics",w:0.35},{v:"clothing",w:0.45},{v:"books",w:0.2}])' }
      ],
      surprisalRules: [
        { fieldName: 'currency', type: 'categorical', categoricalWeights: { USD: 0.8, EUR: 0.15, JPY: 0.05 }, weight: 1.5 },
        { fieldName: 'amountUsd', type: 'lognormal', mu: 4.5, sigma: 1.2, weight: 2.0 }
      ]
    },
    {
      nodeId: 'node-order-shipped',
      nodeName: 'Order Fulfillment Service',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'orders.fulfilled',
      emissionRateHz: 50,
      synthesisRules: [
        { fieldName: 'orderId', ruleExpression: '$PREV.orderId' },
        { fieldName: 'customerId', ruleExpression: '$PREV.customerId' },
        { fieldName: 'status', ruleExpression: '"SHIPPED"' },
        { fieldName: 'trackingCode', ruleExpression: '/^1Z[A-Z0-9]{16}$/' },
        { fieldName: 'shippedTimestamp', ruleExpression: '$NOW_MS' }
      ],
      surprisalRules: [
        { fieldName: 'status', type: 'categorical', categoricalWeights: { SHIPPED: 0.99 }, weight: 1.0 }
      ]
    },
    {
      nodeId: 'node-payment-failed',
      nodeName: 'Payment Risk & DLQ Route',
      nodeType: 'dlq_route',
      protocol: 'KAFKA',
      targetTopicOrUri: 'orders.payment_failed.dlq',
      emissionRateHz: 10,
      synthesisRules: [
        { fieldName: 'orderId', ruleExpression: '$PREV.orderId' },
        { fieldName: 'customerId', ruleExpression: '$PREV.customerId' },
        { fieldName: 'status', ruleExpression: '"DECLINED"' },
        { fieldName: 'errorCode', ruleExpression: 'faker.helpers.weighted([{v:"ERR_INSUFFICIENT_FUNDS",w:0.6},{v:"ERR_FRAUD_FLAG",w:0.3},{v:"ERR_GATEWAY_TIMEOUT",w:0.1}])' },
        { fieldName: 'failedAt', ruleExpression: '$NOW_MS' }
      ],
      surprisalRules: [
        { fieldName: 'errorCode', type: 'categorical', categoricalWeights: { ERR_INSUFFICIENT_FUNDS: 0.6, ERR_FRAUD_FLAG: 0.3, ERR_GATEWAY_TIMEOUT: 0.1 }, weight: 2.5 }
      ]
    }
  ]
};
