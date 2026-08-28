import { z } from 'zod';
import { FieldSynthesisRule, SynthesisEngine } from './synthesis-engine.js';
import { FieldSurprisalRule, SurprisalEngine, PacketSurprisalScore } from './surprisal-engine.js';

export type NodeType = 'producer' | 'markov_fork' | 'aggregator' | 'dlq_route' | 'timer';

export const SimulationNodeSchema = z.object({
  nodeId: z.string().min(1),
  nodeName: z.string().min(1),
  nodeType: z.enum(['producer', 'markov_fork', 'aggregator', 'dlq_route', 'timer']),
  protocol: z.enum(['KAFKA', 'AMQP', 'NATS', 'MQTT', 'HTTP']),
  targetTopicOrUri: z.string().min(1),
  emissionRateHz: z.number().nonnegative().max(1_000_000).optional().default(100),
  delayMs: z.number().nonnegative().optional().default(0),
  markovBranches: z.array(z.object({
    targetNodeId: z.string().min(1),
    probability: z.number().min(0).max(1)
  })).optional(),
  synthesisRules: z.array(z.object({
    fieldName: z.string().min(1),
    ruleExpression: z.string()
  })).optional().default([]),
  surprisalRules: z.array(z.object({
    fieldName: z.string().min(1),
    type: z.enum(['categorical', 'gaussian', 'lognormal']),
    weight: z.number().optional(),
    categoricalWeights: z.record(z.number()).optional(),
    mu: z.number().optional(),
    sigma: z.number().optional()
  })).optional().default([])
}).superRefine((data, ctx) => {
  if (data.markovBranches && data.markovBranches.length > 0) {
    const sum = data.markovBranches.reduce((acc, b) => acc + b.probability, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['markovBranches'],
        message: `Markov branch probabilities must sum to 1.0 (got ${sum.toFixed(3)})`
      });
    }
  }
});

export type SimulationNodeConfig = z.input<typeof SimulationNodeSchema>;
export type ParsedSimulationNodeConfig = z.output<typeof SimulationNodeSchema>;

export interface EventPacket {
  readonly packetId: string;
  readonly correlationId: string;
  readonly timestamp: number;
  readonly nodeId: string;
  readonly protocol: string;
  readonly targetTopicOrUri: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly surprisalBits: number;
  readonly isAnomaly: boolean;
  readonly fieldBreakdown: Readonly<Record<string, { probability: number; surprisalBits: number }>>;
  readonly executionLatencyMs?: number;
}

/**
 * Finite State Machine (FSM) Engine.
 * Orchestrates event choreography across multi-node graphs, handling Markov branching,
 * correlation ID inheritance (`$PREV.orderId`), and timer/dilation delays.
 */
export class FSMEngine {
  private readonly nodesMap: ReadonlyMap<string, ParsedSimulationNodeConfig>;
  private readonly surprisalEngine: SurprisalEngine;

  constructor(
    nodes: ReadonlyArray<SimulationNodeConfig>,
    anomalyThresholdBits = 6.0
  ) {
    const map = new Map<string, ParsedSimulationNodeConfig>();
    for (const node of nodes) {
      const parsedNode = SimulationNodeSchema.parse(node); // Zod boundary check
      map.set(parsedNode.nodeId, parsedNode);
    }
    this.nodesMap = map;
    this.surprisalEngine = new SurprisalEngine(anomalyThresholdBits);
  }

  /**
   * Evaluates and steps through an FSM node, synthesizing payload and scoring surprisal.
   *
   * @param nodeId - ID of the active node being stepped.
   * @param parentPacket - Previous upstream packet (`$PREV`), if any.
   * @returns Generated immutable event packet with correlation and surprisal tags.
   */
  public stepNode(
    nodeId: string,
    parentPacket?: Readonly<EventPacket>
  ): { packet: EventPacket | null; nextNodeId?: string } {
    const startPerf = performance.now();
    const node = this.nodesMap.get(nodeId);
    if (!node) {
      throw new Error(`[FSMEngine] Unknown node ID requested: ${nodeId}`);
    }

    const nextNodeId = this.selectNextMarkovNode(node);

    if (node.emissionRateHz === 0) {
      return { packet: null, nextNodeId };
    }

    // Prepare correlation context from upstream
    const correlationContext: Record<string, unknown> = parentPacket?.payload
      ? { ...parentPacket.payload }
      : {};

    // Synthesize payload
    const payload = SynthesisEngine.synthesizePayload(node.synthesisRules || [], correlationContext);

    // Score self-information I(x)
    const surprisalScore: PacketSurprisalScore = this.surprisalEngine.scorePacket(
      payload,
      node.surprisalRules || []
    );

    const correlationId = parentPacket?.correlationId
      ? parentPacket.correlationId
      : String(
          payload['orderId'] || payload['transactionId'] || payload['txId'] ||
          payload['requestId'] || payload['sessionId'] || payload['userId'] ||
          payload['id'] || `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        );

    const endPerf = performance.now();
    const executionLatencyMs = Number((endPerf - startPerf).toFixed(3));

    const packet: EventPacket = {
      packetId: crypto.randomUUID(),
      correlationId,
      timestamp: Date.now(),
      nodeId: node.nodeId,
      protocol: node.protocol,
      targetTopicOrUri: node.targetTopicOrUri,
      payload,
      surprisalBits: surprisalScore.totalSurprisalBits,
      isAnomaly: surprisalScore.isAnomaly,
      fieldBreakdown: surprisalScore.fieldBreakdown,
      executionLatencyMs
    };

    return { packet, nextNodeId };
  }

  /**
   * Selects the next node ID based on weighted Markov probabilities.
   */
  private selectNextMarkovNode(node: ParsedSimulationNodeConfig): string | undefined {
    if (!node.markovBranches || node.markovBranches.length === 0) {
      // Implicitly link to the next sequential node in the FSM array if no branches exist
      const nodeIds = Array.from(this.nodesMap.keys());
      const currentIndex = nodeIds.indexOf(node.nodeId);
      if (currentIndex >= 0 && currentIndex < nodeIds.length - 1) {
        return nodeIds[currentIndex + 1];
      }
      return undefined;
    }

    const rand = Math.random();
    let cumulative = 0;
    for (const branch of node.markovBranches) {
      cumulative += branch.probability;
      if (rand <= cumulative) {
        return branch.targetNodeId;
      }
    }
    return node.markovBranches[node.markovBranches.length - 1]?.targetNodeId;
  }

  /**
   * Returns the embedded Surprisal Engine instance.
   */
  public getSurprisalEngine(): SurprisalEngine {
    return this.surprisalEngine;
  }

  public getNodeConfig(nodeId: string): SimulationNodeConfig | undefined {
    return this.nodesMap.get(nodeId);
  }
}
