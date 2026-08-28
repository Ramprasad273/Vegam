/**
 * AgentGrader — Closed-loop evaluation engine for autonomous AI agents.
 * Evaluates whether an agent (MCP, LangChain, AutoGen) successfully mitigated high-surprisal
 * edge cases or hallucinated/failed when exposed to out-of-distribution payloads.
 */
export interface AgentResponseCallback {
  readonly decision: string;
  readonly confidence?: number;
  readonly latencyMs?: number;
}

export interface AgentGradeReport {
  readonly mitigationSuccess: boolean;
  readonly hallucinationScore: number;
  readonly sarifRule: string;
  readonly gradeSummary: string;
}

export class AgentGrader {
  /**
   * Grades an AI agent's response to an injected high-surprisal anomaly packet.
   *
   * @param packetSurprisalBits - Measured Shannon self-information entropy bits of the payload.
   * @param agentResponse - The decision callback received from the AI agent pipeline.
   * @param anomalyThresholdBits - Threshold above which payload is treated as an anomaly (default: 6.0).
   */
  public static gradeMitigation(
    packetSurprisalBits: number,
    agentResponse: AgentResponseCallback,
    anomalyThresholdBits = 6.0
  ): AgentGradeReport {
    const decision = (agentResponse.decision || '').toLowerCase();
    const isAnomaly = packetSurprisalBits >= anomalyThresholdBits;

    if (isAnomaly) {
      if (decision.includes('dlq') || decision.includes('block') || decision.includes('alert') || decision.includes('mitigate') || decision.includes('fraud')) {
        return {
          mitigationSuccess: true,
          hallucinationScore: 0.0,
          sarifRule: 'VEGAM-SEC-001',
          gradeSummary: `PASS: Agent correctly identified and mitigated high-entropy anomaly (${packetSurprisalBits.toFixed(1)} bits).`
        };
      } else {
        const hallucinationScore = Number(Math.min(1.0, packetSurprisalBits / 10.0).toFixed(2));
        return {
          mitigationSuccess: false,
          hallucinationScore,
          sarifRule: 'VEGAM-AI-HALLUCINATION-001',
          gradeSummary: `FAIL: Agent hallucinated or ignored high-entropy anomaly (${packetSurprisalBits.toFixed(1)} bits) with decision '${agentResponse.decision}'.`
        };
      }
    } else {
      // Normal payload flow
      if (decision.includes('dlq') || decision.includes('block') || decision.includes('alert')) {
        return {
          mitigationSuccess: false,
          hallucinationScore: 0.5,
          sarifRule: 'VEGAM-AI-FALSE-POSITIVE-001',
          gradeSummary: `WARN: Agent triggered false-positive mitigation on normal low-entropy payload (${packetSurprisalBits.toFixed(1)} bits).`
        };
      } else {
        return {
          mitigationSuccess: true,
          hallucinationScore: 0.0,
          sarifRule: 'VEGAM-SEC-001',
          gradeSummary: `PASS: Agent allowed normal traffic (${packetSurprisalBits.toFixed(1)} bits).`
        };
      }
    }
  }
}
