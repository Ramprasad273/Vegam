import { FSMEngine, EventPacket } from './fsm-engine.js';
import { RuntimeLimiter } from '../governor/runtime-limiter.js';
import { QuotaTracker } from '../governor/quota-tracker.js';

export interface WorkerTaskBatch {
  readonly runId: string;
  readonly startNodeId: string;
  readonly batchSize: number;
}

export interface WorkerBatchResult {
  readonly packets: ReadonlyArray<EventPacket>;
  readonly durationMs: number;
  readonly anomalyCount: number;
}

/**
 * Async Batch Executor.
 * Runs simulation batches across the FSM engine with governor quota tracking.
 * Events are synthesized synchronously within each batch; batches are sequenced
 * by the caller in `route.ts` with a short `setTimeout` yield between them to
 * avoid blocking the Node.js event loop.
 */
export class WorkerPoolManager {
  private isDestroyed = false;

  constructor(private readonly fsmEngine: FSMEngine) {}

  /**
   * Executes a single batch of simulation events through the FSM engine.
   *
   * @param taskBatch - Batch instructions including startNodeId and batch size.
   * @returns WorkerBatchResult containing synthesized packets and metrics.
   */
  public async executeBatch(taskBatch: WorkerTaskBatch): Promise<WorkerBatchResult> {
    if (this.isDestroyed) {
      throw new Error('[WorkerPoolManager] Pool has been destroyed. Cannot execute batch.');
    }

    const startMs = Date.now();
    const packets: EventPacket[] = [];
    let anomalyCount = 0;

    const count = Math.max(1, taskBatch.batchSize);

    for (let i = 0; i < count; i++) {
      if (this.isDestroyed) break;

      let currentNodeId: string | undefined = taskBatch.startNodeId;
      let parentPacket: EventPacket | undefined = undefined;

      // Traverse FSM graph for this event — depth-limited to prevent infinite loops
      let depth = 0;
      while (currentNodeId && depth < 10) {
        const stepResult = this.fsmEngine.stepNode(currentNodeId, parentPacket);
        currentNodeId = stepResult.nextNodeId;
        depth++;

        if (stepResult.packet) {
          parentPacket = stepResult.packet;
          const payloadBytes = Buffer.byteLength(JSON.stringify(parentPacket.payload), 'utf8');
          RuntimeLimiter.assertPayloadSize(payloadBytes);
          QuotaTracker.consume(payloadBytes);

          if (parentPacket.isAnomaly) anomalyCount++;
          packets.push(parentPacket);
        }
      }
    }

    return {
      packets,
      durationMs: Math.max(1, Date.now() - startMs),
      anomalyCount
    };
  }

  /**
   * Marks this instance as destroyed. Subsequent `executeBatch` calls will throw.
   */
  public destroy(): void {
    this.isDestroyed = true;
  }
}
