import fs from 'node:fs';
import path from 'node:path';
import { TrafficSynthesizer } from '@vegam/engine';

export interface CaptureCommandOptions {
  input: string;
  output: string;
  name?: string;
}

/**
 * Executes 'vegam capture' — reads sample JSON packets from file or recording and auto-synthesizes stateful YAML.
 */
export async function executeCaptureCommand(options: CaptureCommandOptions): Promise<string> {
  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input sample file not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, 'utf8').trim();
  let packets: Array<Record<string, unknown>> = [];

  if (raw.startsWith('[') && raw.endsWith(']')) {
    packets = JSON.parse(raw);
  } else {
    // Parse JSONL
    const lines = raw.split('\n').filter(Boolean);
    packets = lines.map(line => JSON.parse(line));
  }

  const scenarioName = options.name || path.basename(options.output, path.extname(options.output));
  const yamlOutput = TrafficSynthesizer.synthesizeYaml(scenarioName, packets);

  const outputPath = path.resolve(options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, yamlOutput, 'utf8');

  console.info(`[Vegam Capture] Successfully synthesized stateful YAML (${packets.length} packets -> ${outputPath})`);
  return yamlOutput;
}
