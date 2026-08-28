import { z } from 'zod';
import { SimulationNodeSchema, SimulationNodeConfig } from '../simulation/fsm-engine.js';

export const VegamScenarioSchema = z.object({
  scenarioId: z.string().min(1),
  scenarioName: z.string().min(1),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  concurrency: z.number().int().positive().max(64).default(2),
  anomalyThresholdBits: z.number().positive().default(6.0),
  nodes: z.array(SimulationNodeSchema).min(1),
  chaos: z.object({
    enabled: z.boolean().optional().default(false),
    mode: z.enum(['latency_jitter', 'dlq_route', 'null_injection', 'schema_corrupt', 'none']).optional().default('none'),
    probability: z.number().min(0).max(1).optional().default(0.05),
    latencyMs: z.number().nonnegative().optional(),
    dlqTopicOrUri: z.string().optional(),
    targetFields: z.array(z.string()).optional()
  }).optional().default({ enabled: false, mode: 'none', probability: 0 })
});

export type VegamScenarioConfig = z.input<typeof VegamScenarioSchema>;

/**
 * Configuration & Scenario Manager.
 * Validates raw scenario definitions across strict Zod boundary schemas.
 */
export class ConfigManager {
  /**
   * Parses and validates a raw configuration object or JSON/YAML string against `VegamScenarioSchema`.
   *
   * @param rawConfig - The input scenario data.
   * @returns Strictly validated, immutable `VegamScenarioConfig`.
   */
  public static validateScenario(rawConfig: unknown): VegamScenarioConfig {
    let target = rawConfig;
    if (typeof rawConfig === 'string') {
      try {
        target = JSON.parse(rawConfig);
      } catch (err) {
        throw new Error(`[ConfigManager] Failed to parse scenario string as JSON: ${String(err)}`);
      }
    }

    const parseResult = VegamScenarioSchema.safeParse(target);
    if (!parseResult.success) {
      console.error('[ConfigManager] Scenario validation failed:', parseResult.error.format());
      throw new Error(`Invalid Vegam Scenario definition: ${parseResult.error.message}`);
    }

    return parseResult.data;
  }
}
