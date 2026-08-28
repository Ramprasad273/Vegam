import fs from 'node:fs/promises';
import { FSMEngine, WorkerPoolManager, ConfigManager, VegamScenarioConfig, RuntimeLimiter, QuotaTracker, VegamGovernor, EventPacket } from '@vegam/engine';
import { ConnectorPool, KafkaAdapter, RabbitMQAdapter, NatsAdapter, MQTTAdapter, HTTPAdapter } from '@vegam/connectors';
import { getTemplateById, ALL_TEMPLATES } from '@vegam/templates';
import kleur from 'kleur';

export interface RunOptions {
  readonly scenario?: string;
  readonly template?: string;
  readonly rate?: number;
  readonly duration?: number; // seconds
  readonly governor?: boolean;
  readonly emit?: boolean;
  readonly quiet?: boolean;
}

/**
 * Executes a simulation scenario in terminal CLI mode (`vegam run`).
 */
export async function executeRunCommand(options: RunOptions): Promise<ReadonlyArray<EventPacket>> {
  if (options.governor) {
    VegamGovernor.setEnabled(true);
  }

  let scenarioConfig: VegamScenarioConfig | undefined;

  if (options.template) {
    scenarioConfig = getTemplateById(options.template);
    if (!scenarioConfig) {
      console.error(kleur.red(`Unknown template: ${options.template}. Available: ${ALL_TEMPLATES.map((t) => t.scenarioId).join(', ')}`));
      process.exit(1);
    }
  } else if (options.scenario) {
    const rawContent = await fs.readFile(options.scenario, 'utf8');
    scenarioConfig = ConfigManager.validateScenario(rawContent);
  } else {
    // Default to ECommerce Checkout template if nothing passed
    scenarioConfig = getTemplateById('ecommerce-checkout-v1');
  }

  if (!scenarioConfig) {
    console.error(kleur.red('No valid scenario configuration loaded. Use --template or --scenario.'));
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(kleur.cyan().bold(`\nVegam Simulation Engine CLI v1.0.0`));
    console.log(kleur.gray(`Scenario: `) + kleur.white().bold(scenarioConfig.scenarioName));
    console.log(kleur.gray(`Nodes: `) + kleur.white(scenarioConfig.nodes.length) + kleur.gray(` | Concurrency: `) + kleur.white(scenarioConfig.concurrency ?? 1));
    console.log(kleur.gray(`Governor Status: `) + (VegamGovernor.isEnabled() ? kleur.green().bold('ACTIVE ($0 cloud cap)') : kleur.yellow('DISABLED (Unlimited 24/7)')));
  }

  const fsmEngine = new FSMEngine(scenarioConfig.nodes, scenarioConfig.anomalyThresholdBits);
  const workerPool = new WorkerPoolManager(fsmEngine);
  const connectorPool = new ConnectorPool();

  if (options.emit) {
    if (!options.quiet) console.log(kleur.magenta('Plug & Play BYOB connecting to outbound protocol targets...'));
    for (const node of scenarioConfig.nodes) {
      let adapter;
      switch (node.protocol) {
        case 'KAFKA': adapter = new KafkaAdapter(); break;
        case 'AMQP': adapter = new RabbitMQAdapter(); break;
        case 'NATS': adapter = new NatsAdapter(); break;
        case 'MQTT': adapter = new MQTTAdapter(); break;
        case 'HTTP': adapter = new HTTPAdapter(); break;
        default: adapter = new HTTPAdapter();
      }
      await connectorPool.registerConnector(node.nodeId, node.targetTopicOrUri, adapter);
    }
  }

  const targetHz = options.rate ?? scenarioConfig.nodes[0]?.emissionRateHz ?? 100;
  const durationSec = options.duration ?? 10;
  const totalIterations = durationSec * targetHz;
  const allPackets: EventPacket[] = [];
  let anomaliesCount = 0;

  const startMs = Date.now();
  const firstNodeId = scenarioConfig.nodes[0]?.nodeId || 'node-1';

  // Process batches of 10 events
  const batchSize = Math.min(50, Math.max(1, Math.floor(targetHz / 10)));
  const numBatches = Math.ceil(totalIterations / batchSize);

  for (let b = 0; b < numBatches; b++) {
    const batchResult = await workerPool.executeBatch({
      runId: `run-${startMs}`,
      startNodeId: firstNodeId,
      batchSize
    });

    allPackets.push(...batchResult.packets);
    anomaliesCount += batchResult.anomalyCount;

    // Stream generated event packets to stdout as JSON lines for downstream pipeline ingestion
    for (const pkt of batchResult.packets) {
      console.log(JSON.stringify(pkt));
    }

    if (options.emit) {
      for (const pkt of batchResult.packets) {
        await connectorPool.emitToConnector(pkt.nodeId, [pkt]);
      }
    }

    // Small delay to simulate steady tick pacing
    await new Promise((r) => setTimeout(r, Math.floor(1000 / (targetHz / batchSize))));
  }

  workerPool.destroy();
  if (options.emit) {
    await connectorPool.disconnectAll();
  }

  const elapsedSec = (Date.now() - startMs) / 1000;
  const actualHz = Math.round(allPackets.length / elapsedSec);
  const avgEntropy = fsmEngine.getSurprisalEngine().getShannonEntropy();

  if (!options.quiet) {
    console.log(kleur.green().bold(`\n✅ Simulation Completed in ${elapsedSec.toFixed(2)}s`));
    console.log(kleur.white(`Generated Events: `) + kleur.bold().cyan(allPackets.length) + kleur.gray(` (${actualHz} ev/sec)`));
    console.log(kleur.white(`Average Entropy H(X): `) + kleur.bold().yellow(`${avgEntropy} bits`));
    console.log(kleur.white(`Surprisal Outliers/Anomalies: `) + (anomaliesCount > 0 ? kleur.bold().red(`${anomaliesCount}`) : kleur.bold().green('0')));
    console.log();
  }

  return allPackets;
}
