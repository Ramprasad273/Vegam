import { EventPacket } from '../simulation/fsm-engine.js';

export type ChaosMode = 'latency_jitter' | 'dlq_route' | 'null_injection' | 'schema_corrupt' | 'none';

export interface ChaosConfig {
  readonly enabled: boolean;
  readonly mode: ChaosMode;
  readonly probability: number; // 0..1
  readonly latencyMs?: number;  // e.g. 500ms spike
  readonly dlqTopicOrUri?: string;
  readonly targetFields?: ReadonlyArray<string>;
}

/**
 * Surprisal-Guided & Stochastic Chaos Injector.
 * Intercepts outbound event packets. When an event's self-information `I(x)` exceeds the anomaly
 * threshold (or under configured stochastic probability), injects targeted chaos to stress-test
 * downstream consumers during rare edge cases.
 */
export class ChaosInjector {
  constructor(private readonly config: ChaosConfig) {}

  /**
   * Evaluates an event packet and applies chaos injection if triggered.
   *
   * @param packet - Immutable source event packet.
   * @returns Modified event packet (or original if no chaos triggered).
   */
  public async injectChaos(packet: Readonly<EventPacket>): Promise<EventPacket> {
    if (!this.config.enabled || this.config.mode === 'none') {
      return packet;
    }

    // Trigger if packet is an information-theoretic anomaly OR under configured random probability
    const shouldTrigger = packet.isAnomaly || Math.random() < this.config.probability;
    if (!shouldTrigger) {
      return packet;
    }

    console.warn(`[ChaosInjector] Chaos triggered on packet ${packet.packetId} (Mode: ${this.config.mode}, Surprisal: ${packet.surprisalBits} bits)`);

    switch (this.config.mode) {
      case 'latency_jitter': {
        const delay = this.config.latencyMs ?? 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return {
          ...packet,
          payload: {
            ...packet.payload,
            _vegam_chaos: { injected_delay_ms: delay, mode: 'latency_jitter' }
          }
        };
      }

      case 'dlq_route': {
        const dlqTarget = this.config.dlqTopicOrUri ?? `${packet.targetTopicOrUri}.DLQ`;
        console.warn(`[ChaosInjector] Rerouting packet to DLQ target: ${dlqTarget}`);
        return {
          ...packet,
          targetTopicOrUri: dlqTarget,
          payload: {
            ...packet.payload,
            _vegam_chaos: { original_target: packet.targetTopicOrUri, mode: 'dlq_route' }
          }
        };
      }

      case 'null_injection': {
        const modifiedPayload = { ...packet.payload };
        const fields = this.config.targetFields ?? Object.keys(modifiedPayload).filter((k) => !k.startsWith('_'));
        for (const field of fields) {
          if (field in modifiedPayload) {
            modifiedPayload[field] = null;
          }
        }
        modifiedPayload['_vegam_chaos'] = { nulled_fields: fields, mode: 'null_injection' };
        return {
          ...packet,
          payload: modifiedPayload
        };
      }

      case 'schema_corrupt': {
        const modifiedPayload: Record<string, unknown> = { ...packet.payload };
        // Corrupt type of first non-metadata numeric or string field
        const targetField = Object.keys(modifiedPayload).find((k) => typeof modifiedPayload[k] === 'number' || typeof modifiedPayload[k] === 'string');
        if (targetField) {
          const oldVal = modifiedPayload[targetField];
          modifiedPayload[targetField] = typeof oldVal === 'number' ? 'CORRUPTED_NAN_STRING' : -999999;
          modifiedPayload['_vegam_chaos'] = { corrupted_field: targetField, old_type: typeof oldVal, mode: 'schema_corrupt' };
        }
        return {
          ...packet,
          payload: modifiedPayload
        };
      }

      default:
        return packet;
    }
  }
}
