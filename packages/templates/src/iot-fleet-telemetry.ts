import { VegamScenarioConfig } from '@vegam/engine';

export const IoTFleetTelemetryTemplate: VegamScenarioConfig = {
  scenarioId: 'iot-fleet-telemetry-v1',
  scenarioName: 'IoT Connected Fleet Telemetry & Sensor Drift',
  description: 'Simulates 50+ connected vehicles emitting MQTT telemetry (engine temp, RPM, GPS coordinates) with periodic sensor drift and null signal chaos injection.',
  version: '1.0.0',
  concurrency: 4,
  anomalyThresholdBits: 6.2,
  chaos: {
    enabled: true,
    mode: 'null_injection',
    probability: 0.04,
    targetFields: ['gpsLat', 'gpsLng', 'batteryPercent']
  },
  nodes: [
    {
      nodeId: 'node-vehicle-sensor',
      nodeName: 'OBD-II Telemetry Sensor Unit',
      nodeType: 'producer',
      protocol: 'MQTT',
      targetTopicOrUri: 'fleet/telemetry/v1/sensors',
      emissionRateHz: 100,
      synthesisRules: [
        { fieldName: 'deviceId', ruleExpression: '$DEVICE_POOL[rand]' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        { fieldName: 'engineTempC', ruleExpression: 'faker.number.float({min:85.0,max:105.0,fractionDigits:1})' },
        { fieldName: 'engineRpm', ruleExpression: 'faker.number.int({min:1200,max:3800})' },
        { fieldName: 'speedMph', ruleExpression: 'faker.number.float({min:0.0,max:75.0,fractionDigits:1})' },
        { fieldName: 'batteryPercent', ruleExpression: 'faker.number.int({min:20,max:100})' },
        { fieldName: 'gpsLat', ruleExpression: 'faker.location.latitude()' },
        { fieldName: 'gpsLng', ruleExpression: 'faker.location.longitude()' },
        { fieldName: 'firmwareVersion', ruleExpression: 'faker.helpers.weighted([{v:"v2.4.1-stable",w:0.90},{v:"v2.5.0-beta",w:0.09},{v:"v1.9.8-legacy",w:0.01}])' }
      ],
      surprisalRules: [
        { fieldName: 'engineTempC', type: 'gaussian', mu: 92.0, sigma: 4.5, weight: 2.0 },
        { fieldName: 'firmwareVersion', type: 'categorical', categoricalWeights: { 'v2.4.1-stable': 0.90, 'v2.5.0-beta': 0.09, 'v1.9.8-legacy': 0.01 }, weight: 2.5 }
      ]
    }
  ]
};
