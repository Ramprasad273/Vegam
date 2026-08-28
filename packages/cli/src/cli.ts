#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { executeRunCommand } from './commands/run.js';
import { executeExportCommand } from './commands/export.js';
import { executeImportCommand } from './commands/import.js';
import { executeCaptureCommand } from './commands/capture.js';
import { executeTuiCommand } from './commands/tui.js';

const require = createRequire(import.meta.url);
let cliVersion = '1.0.0';
try {
  const pkg = require('../package.json');
  if (pkg?.version) cliVersion = pkg.version;
} catch {
  // fallback default
}

const program = new Command();

program
  .name('vegam')
  .description('Universal Event & Telemetry Simulation Platform CLI')
  .version(cliVersion);

program
  .command('run')
  .description('Run a simulation scenario or pre-packaged template')
  .option('-s, --scenario <file>', 'Path to .vegam JSON/YAML scenario file')
  .option('-t, --template <name>', 'Pre-packaged template ID (ecommerce-checkout-v1, etc.)')
  .option('-r, --rate <hz>', 'Override emission rate in Hz (events/sec)', parseInt)
  .option('-d, --duration <seconds>', 'Simulation duration in seconds', parseInt, 10)
  .option('-g, --governor', 'Enforce Hosted Sandbox 60s hard stop and 100 ev/s limit', false)
  .option('-e, --emit', 'Emit packets over BYOB outbound sockets (Kafka, MQTT, NATS, etc.)', false)
  .option('-q, --quiet', 'Suppress non-essential console logs', false)
  .action(async (options) => {
    try {
      await executeRunCommand(options);
    } catch (err) {
      console.error('\n[Fatal Error]', err);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Run scenario and export traffic/anomalies to JUnit XML, SARIF, or JSONL')
  .requiredOption('-o, --output <file>', 'Destination output file path')
  .option('-f, --format <type>', 'Export format: jsonl, csv, junit, sarif', 'jsonl')
  .option('-s, --scenario <file>', 'Path to .vegam JSON/YAML scenario file')
  .option('-t, --template <name>', 'Pre-packaged template ID')
  .option('-r, --rate <hz>', 'Emission rate in Hz', parseInt, 100)
  .option('-d, --duration <seconds>', 'Simulation duration in seconds', parseInt, 5)
  .action(async (options) => {
    try {
      await executeExportCommand(options);
    } catch (err) {
      console.error('\n[Export Fatal Error]', err);
      process.exit(1);
    }
  });

program
  .command('import')
  .description('Import recorded traffic or OpenAPI spec into a Vegam scenario')
  .requiredOption('-i, --input <file>', 'Input spec or traffic recording file')
  .requiredOption('-p, --protocol <type>', 'Format protocol: openapi, asyncapi, jsonl')
  .requiredOption('-o, --output <file>', 'Output .vegam JSON file path')
  .action(async (options) => {
    try {
      await executeImportCommand(options);
    } catch (err) {
      console.error('\n[Import Fatal Error]', err);
      process.exit(1);
    }
  });

program
  .command('capture')
  .description('Auto-synthesize stateful YAML scenario from captured broker traffic file')
  .requiredOption('-i, --input <file>', 'Input JSON/JSONL sample traffic file')
  .requiredOption('-o, --output <file>', 'Output YAML scenario file path')
  .option('-n, --name <name>', 'Scenario name override')
  .action(async (options) => {
    try {
      await executeCaptureCommand(options);
    } catch (err) {
      console.error('\n[Capture Fatal Error]', err);
      process.exit(1);
    }
  });

program
  .command('tui')
  .description('Run live terminal UI dashboard monitoring surprisal entropy and anomaly streams')
  .option('-t, --template <name>', 'Pre-packaged template ID', 'fintech-fraud-surprisal-v1')
  .option('-r, --rate <hz>', 'Target emission rate in Hz', parseInt, 50)
  .option('-d, --duration <seconds>', 'Dashboard run duration in seconds', parseInt, 3)
  .action(async (options) => {
    try {
      await executeTuiCommand(options);
    } catch (err) {
      console.error('\n[TUI Fatal Error]', err);
      process.exit(1);
    }
  });

program.parse(process.argv);

