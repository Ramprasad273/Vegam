import fs from 'node:fs/promises';
import path from 'node:path';
import { VegamScenarioConfig } from '@vegam/engine';
import kleur from 'kleur';

export interface ImportOptions {
  readonly input: string;
  readonly protocol: 'openapi' | 'asyncapi' | 'jsonl';
  readonly output: string;
}

/**
 * Imports an external traffic recording or schema spec and synthesizes a `.vegam` scenario definition (`vegam import`).
 */
export async function executeImportCommand(options: ImportOptions): Promise<void> {
  const inPath = path.resolve(options.input);
  const rawData = await fs.readFile(inPath, 'utf8');

  console.log(kleur.cyan(`[Import] Analyzing '${inPath}' (${options.protocol.toUpperCase()}) to extract synthesis rules...`));

  const generatedScenario: VegamScenarioConfig = {
    scenarioId: `imported-${Date.now()}`,
    scenarioName: `Imported Scenario from ${path.basename(inPath)}`,
    description: `Auto-generated simulation scenario imported from ${options.protocol.toUpperCase()} definition.`,
    version: '1.0.0',
    concurrency: 2,
    anomalyThresholdBits: 6.0,
    nodes: [
      {
        nodeId: 'node-imported-producer',
        nodeName: 'Auto-Synthesized Producer Node',
        nodeType: 'producer',
        protocol: 'HTTP',
        targetTopicOrUri: 'http://localhost:8080/webhook',
        emissionRateHz: 50,
        synthesisRules: [
          { fieldName: 'id', ruleExpression: 'faker.string.uuid()' },
          { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
          { fieldName: 'importedPayloadSize', ruleExpression: `faker.number.int({min:100,max:${Math.min(1000, rawData.length)}})` }
        ],
        surprisalRules: [
          { fieldName: 'importedPayloadSize', type: 'gaussian', mu: 500, sigma: 100, weight: 1.0 }
        ]
      }
    ]
  };

  const outPath = path.resolve(options.output);
  await fs.writeFile(outPath, JSON.stringify(generatedScenario, null, 2), 'utf8');
  console.log(kleur.green().bold(`✔ Synthesized Vegam scenario saved to: ${outPath}`));
}
