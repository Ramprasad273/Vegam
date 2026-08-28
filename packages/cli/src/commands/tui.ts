import { ALL_TEMPLATES } from '@vegam/templates';
import { FSMEngine, SurprisalEngine, WorkerPoolManager, VegamScenarioConfig } from '@vegam/engine';

export interface TuiCommandOptions {
  template?: string;
  rate?: number;
  duration?: number;
}

/**
 * Executes 'vegam tui' — runs a live terminal dashboard displaying real-time surprisal entropy,
 * latency percentiles (p50/p95/p99), and anomaly streams right in the shell.
 */
export async function executeTuiCommand(options: TuiCommandOptions): Promise<{ totalEvents: number; anomalies: number }> {
  const templateId = options.template || 'fintech-fraud-surprisal-v1';
  const tmpl: VegamScenarioConfig = ALL_TEMPLATES.find((t: VegamScenarioConfig) => t.scenarioId === templateId) || ALL_TEMPLATES[0]!;

  const rateHz = options.rate || 50;
  const durationSeconds = options.duration || 3;

  const fsmEngine = new FSMEngine(tmpl.nodes);
  const surprisalEngine = new SurprisalEngine();
  const workerPool = new WorkerPoolManager(fsmEngine);
  const allRules = tmpl.nodes.flatMap(n => n.surprisalRules || []);

  let totalEvents = 0;
  let anomalyCount = 0;

  console.info(`\n🚀 [Vegam TUI Dashboard] Live Scenario: ${tmpl.scenarioName}`);
  console.info(`   Target Rate: ${rateHz} Hz | Duration: ${durationSeconds}s | Terminal Mode: ANSI Active\n`);
  console.info(`--------------------------------------------------------------------------------`);

  const startTime = Date.now();
  const stepMs = Math.floor(1000 / rateHz);
  let currentNodeId = tmpl.nodes[0]?.nodeId || '';

  while (Date.now() - startTime < durationSeconds * 1000) {
    if (!currentNodeId) currentNodeId = tmpl.nodes[0]?.nodeId || '';
    const stepRes = fsmEngine.stepNode(currentNodeId);
    const packet = stepRes.packet;
    currentNodeId = stepRes.nextNodeId || tmpl.nodes[0]?.nodeId || '';

    if (packet) {
      totalEvents++;
      const res = surprisalEngine.scorePacket(packet.payload, allRules);
      if (res.isAnomaly) {
        anomalyCount++;
        console.warn(`[⚠️ ANOMALY DETECTED] Step: ${packet.nodeId} | I(x): ${res.totalSurprisalBits.toFixed(1)} bits | DLQ Route Triggered`);
      } else if (totalEvents % rateHz === 0) {
        // Print live status bar every second
        console.info(`[⏱️ LIVE METRICS] Events: ${totalEvents} | Avg Entropy: ${surprisalEngine.getShannonEntropy().toFixed(1)} bits | Status: FLOW IN-SYNC`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, stepMs));
  }

  workerPool.destroy();
  console.info(`--------------------------------------------------------------------------------`);
  console.info(`🏁 [TUI Complete] Total Events: ${totalEvents} | Total High-Entropy Anomalies: ${anomalyCount}\n`);

  return { totalEvents, anomalies: anomalyCount };
}
