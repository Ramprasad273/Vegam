export * from './ecommerce-checkout.js';
export * from './fintech-fraud-surprisal.js';
export * from './iot-fleet-telemetry.js';
export * from './healthcare-vitals-fhir.js';
export * from './hdfs-distributed-syslog.js';
export * from './hdfs-distributed-syslog-drift.js';
export * from './microservices-api-gateway.js';
export * from './microservices-api-gateway-drift.js';

import { ECommerceCheckoutTemplate } from './ecommerce-checkout.js';
import { FintechFraudSurprisalTemplate } from './fintech-fraud-surprisal.js';
import { IoTFleetTelemetryTemplate } from './iot-fleet-telemetry.js';
import { HealthcareVitalsFHIRTemplate } from './healthcare-vitals-fhir.js';
import { HdfsDistributedSyslogTemplate } from './hdfs-distributed-syslog.js';
import { HdfsDistributedSyslogDriftTemplate } from './hdfs-distributed-syslog-drift.js';
import { MicroservicesApiGatewayTemplate } from './microservices-api-gateway.js';
import { MicroservicesApiGatewayDriftTemplate } from './microservices-api-gateway-drift.js';
import { VegamScenarioConfig } from '@vegam/engine';

/**
 * Registry of all pre-packaged Vegam production templates.
 *
 * NeuroLambda Stage 4 templates:
 *   - hdfs-distributed-syslog-v1        : Scenario A (in-distribution)
 *   - hdfs-distributed-syslog-drift-v1  : Scenario A drift (E3)
 *   - microservices-api-gateway-v1      : Scenario B (zero-shot transfer)
 *   - microservices-api-gateway-drift-v1: Scenario B drift (E3)
 */
export const ALL_TEMPLATES: ReadonlyArray<VegamScenarioConfig> = [
  ECommerceCheckoutTemplate,
  FintechFraudSurprisalTemplate,
  IoTFleetTelemetryTemplate,
  HealthcareVitalsFHIRTemplate,
  HdfsDistributedSyslogTemplate,
  HdfsDistributedSyslogDriftTemplate,
  MicroservicesApiGatewayTemplate,
  MicroservicesApiGatewayDriftTemplate
];

export function getTemplateById(id: string): VegamScenarioConfig | undefined {
  return ALL_TEMPLATES.find((t) => t.scenarioId === id || t.scenarioId.startsWith(id) || t.scenarioId.includes(id));
}
