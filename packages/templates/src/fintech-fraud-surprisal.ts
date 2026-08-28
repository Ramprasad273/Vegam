import { VegamScenarioConfig } from '@vegam/engine';

export const FintechFraudSurprisalTemplate: VegamScenarioConfig = {
  scenarioId: 'fintech-fraud-surprisal-v1',
  scenarioName: 'Fintech Transaction Anomalies & Surprisal Scoring',
  description: 'Simulates global card payments and wire transfers. Highlights high-surprisal information-theoretic anomalies (rare currencies, extreme transaction spikes) in real-time.',
  version: '1.0.0',
  concurrency: 4,
  anomalyThresholdBits: 5.5,
  chaos: {
    enabled: true,
    mode: 'dlq_route',
    probability: 0.03,
    dlqTopicOrUri: 'transactions.suspicious.dlq'
  },
  nodes: [
    {
      nodeId: 'node-tx-gateway',
      nodeName: 'Global Payment Gateway',
      nodeType: 'markov_fork',
      protocol: 'AMQP',
      targetTopicOrUri: 'amq.topic.transactions.settled',
      emissionRateHz: 80,
      markovBranches: [
        { targetNodeId: 'node-tx-normal', probability: 0.96 },
        { targetNodeId: 'node-tx-suspicious', probability: 0.04 }
      ],
      synthesisRules: [
        { fieldName: 'transactionId', ruleExpression: 'faker.string.uuid()' },
        { fieldName: 'accountNumber', ruleExpression: '/^ACC-[0-9]{8}$/' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        { fieldName: 'amountUsd', ruleExpression: 'faker.number.float({min:5,max:450,fractionDigits:2})' },
        { fieldName: 'merchantType', ruleExpression: 'faker.helpers.weighted([{v:"GROCERY",w:0.4},{v:"RESTAURANT",w:0.35},{v:"ONLINE_RETAIL",w:0.22},{v:"CASINO_CRYPTO",w:0.03}])' },
        { fieldName: 'ipCountry', ruleExpression: 'faker.helpers.weighted([{v:"US",w:0.75},{v:"UK",w:0.15},{v:"CA",w:0.08},{v:"CYPRESS_PROXY",w:0.02}])' }
      ],
      surprisalRules: [
        { fieldName: 'merchantType', type: 'categorical', categoricalWeights: { GROCERY: 0.4, RESTAURANT: 0.35, ONLINE_RETAIL: 0.22, CASINO_CRYPTO: 0.03 }, weight: 2.0 },
        { fieldName: 'ipCountry', type: 'categorical', categoricalWeights: { US: 0.75, UK: 0.15, CA: 0.08, CYPRESS_PROXY: 0.02 }, weight: 3.0 },
        { fieldName: 'amountUsd', type: 'gaussian', mu: 65.0, sigma: 40.0, weight: 1.5 }
      ]
    },
    {
      nodeId: 'node-tx-normal',
      nodeName: 'Cleared Settlement Ledger',
      nodeType: 'producer',
      protocol: 'AMQP',
      targetTopicOrUri: 'amq.topic.transactions.cleared',
      emissionRateHz: 80,
      synthesisRules: [
        { fieldName: 'transactionId', ruleExpression: '$PREV.transactionId' },
        { fieldName: 'accountNumber', ruleExpression: '$PREV.accountNumber' },
        { fieldName: 'status', ruleExpression: '"SETTLED_CLEARED"' },
        { fieldName: 'clearedTimestamp', ruleExpression: '$NOW_MS' }
      ],
      surprisalRules: [
        { fieldName: 'status', type: 'categorical', categoricalWeights: { SETTLED_CLEARED: 0.99 }, weight: 1.0 }
      ]
    },
    {
      nodeId: 'node-tx-suspicious',
      nodeName: 'AML Compliance & Fraud Review',
      nodeType: 'dlq_route',
      protocol: 'AMQP',
      targetTopicOrUri: 'amq.topic.transactions.aml_flagged',
      emissionRateHz: 5,
      synthesisRules: [
        { fieldName: 'transactionId', ruleExpression: '$PREV.transactionId' },
        { fieldName: 'accountNumber', ruleExpression: '$PREV.accountNumber' },
        { fieldName: 'status', ruleExpression: '"FLAGGED_AML_HOLD"' },
        { fieldName: 'riskScore', ruleExpression: 'faker.number.float({min:85.0,max:99.9,fractionDigits:1})' },
        { fieldName: 'flaggedTimestamp', ruleExpression: '$NOW_MS' }
      ],
      surprisalRules: [
        { fieldName: 'status', type: 'categorical', categoricalWeights: { FLAGGED_AML_HOLD: 0.04 }, weight: 4.0 }
      ]
    }
  ]
};
