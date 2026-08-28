import { VegamScenarioConfig } from '@vegam/engine';

export const HealthcareVitalsFHIRTemplate: VegamScenarioConfig = {
  scenarioId: 'healthcare-vitals-fhir-v1',
  scenarioName: 'Healthcare ICU Patient Vitals & FHIR Streaming',
  description: 'Simulates continuous patient ICU bedside vitals (Heart Rate, SpO2, Systolic BP) streamed over NATS JetStream with sudden tachycardia/arrhythmia surprisal spikes.',
  version: '1.0.0',
  concurrency: 2,
  anomalyThresholdBits: 5.8,
  chaos: {
    enabled: true,
    mode: 'schema_corrupt',
    probability: 0.02
  },
  nodes: [
    {
      nodeId: 'node-icu-monitor',
      nodeName: 'ICU Bedside Patient Monitor',
      nodeType: 'producer',
      protocol: 'NATS',
      targetTopicOrUri: 'hospital.icu.vitals.stream',
      emissionRateHz: 60,
      synthesisRules: [
        { fieldName: 'patientId', ruleExpression: '/^PT-[1-9][0-9]{4}$/' },
        { fieldName: 'bedId', ruleExpression: 'faker.helpers.weighted([{v:"ICU-BED-01",w:0.25},{v:"ICU-BED-02",w:0.25},{v:"ICU-BED-03",w:0.25},{v:"ICU-BED-04",w:0.25}])' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        { fieldName: 'heartRateBpm', ruleExpression: 'faker.number.int({min:55,max:160})' },
        { fieldName: 'spo2Percent', ruleExpression: 'faker.number.int({min:88,max:100})' },
        { fieldName: 'systolicBp', ruleExpression: 'faker.number.int({min:90,max:180})' },
        { fieldName: 'alertState', ruleExpression: 'faker.helpers.weighted([{v:"NORMAL",w:0.92},{v:"WARNING_ELEVATED",w:0.06},{v:"CRITICAL_TACHYCARDIA",w:0.02}])' }
      ],
      surprisalRules: [
        { fieldName: 'heartRateBpm', type: 'gaussian', mu: 74.0, sigma: 12.0, weight: 2.0 },
        { fieldName: 'spo2Percent', type: 'gaussian', mu: 98.0, sigma: 1.5, weight: 3.0 },
        { fieldName: 'alertState', type: 'categorical', categoricalWeights: { NORMAL: 0.92, WARNING_ELEVATED: 0.06, CRITICAL_TACHYCARDIA: 0.02 }, weight: 4.0 }
      ]
    }
  ]
};
