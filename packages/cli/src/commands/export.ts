import fs from 'node:fs/promises';
import path from 'node:path';
import { executeRunCommand, RunOptions } from './run.js';
import { JUnitReporter } from '../reporters/junit-reporter.js';
import { SARIFReporter } from '../reporters/sarif-reporter.js';
import kleur from 'kleur';

export interface ExportOptions extends RunOptions {
  readonly output: string;
  readonly format: 'jsonl' | 'csv' | 'junit' | 'sarif' | 'parquet';
}

/**
 * Executes a simulation run and exports generated traffic & anomaly audit trails (`vegam export`).
 */
export async function executeExportCommand(options: ExportOptions): Promise<void> {
  console.log(kleur.cyan(`[Export] Running scenario and capturing traffic for format '${options.format.toUpperCase()}'...`));
  const packets = await executeRunCommand({ ...options, quiet: true });

  const outPath = path.resolve(options.output);

  if (options.format === 'junit') {
    await JUnitReporter.generateReport(`run-${Date.now()}`, options.template || options.scenario || 'vegam-suite', packets, outPath);
    console.log(kleur.green().bold(`✔ JUnit XML test report exported to: ${outPath}`));
    return;
  }

  if (options.format === 'sarif') {
    await SARIFReporter.generateReport(`run-${Date.now()}`, options.template || options.scenario || 'vegam-suite', packets, outPath);
    console.log(kleur.green().bold(`✔ SARIF v2.1.0 security audit report exported to: ${outPath}`));
    return;
  }

  if (options.format === 'csv') {
    const lines: string[] = ['packetId,correlationId,timestamp,nodeId,protocol,surprisalBits,isAnomaly'];
    for (const p of packets) {
      lines.push(`${p.packetId},${p.correlationId},${p.timestamp},${p.nodeId},${p.protocol},${p.surprisalBits},${p.isAnomaly}`);
    }
    await fs.writeFile(outPath, lines.join('\n'), 'utf8');
    console.log(kleur.green().bold(`✔ CSV dataset exported to: ${outPath} (${packets.length} records)`));
    return;
  }

  // Default / jsonl
  const jsonlLines = packets.map((p) => JSON.stringify(p));
  await fs.writeFile(outPath, jsonlLines.join('\n') + '\n', 'utf8');
  console.log(kleur.green().bold(`✔ JSONL stream exported to: ${outPath} (${packets.length} records)`));
}
