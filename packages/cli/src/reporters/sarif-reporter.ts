import fs from 'node:fs/promises';
import { EventPacket } from '@vegam/engine';

/**
 * SARIF Static Analysis Results Format Reporter (`vegam-anomalies.sarif`).
 * Formats high-surprisal anomalies into OASIS SARIF v2.1.0 output for GitHub Advanced Security,
 * VS Code SARIF Viewer, and enterprise security scanning dashboards.
 */
export class SARIFReporter {
  public static async generateReport(
    runId: string,
    scenarioName: string,
    packets: ReadonlyArray<EventPacket>,
    outputPath: string
  ): Promise<void> {
    const anomalies = packets.filter((p) => p.isAnomaly);

    const sarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'Vegam Surprisal & Chaos Analyzer',
              version: '1.0.0',
              informationUri: 'https://github.com/vegam-io/vegam',
              rules: [
                {
                  id: 'VEGAM-SURPRISAL-HIGH',
                  name: 'HighSurprisalInformationAnomaly',
                  shortDescription: {
                    text: 'Event self-information I(x) exceeded threshold'
                  },
                  fullDescription: {
                    text: 'An emitted event packet scored a self-information surprisal higher than the defined threshold bits, indicating a statistical outlier or potential schema/payload drift.'
                  },
                  defaultConfiguration: {
                    level: 'warning'
                  }
                }
              ]
            }
          },
          invocations: [
            {
              executionSuccessful: true,
              commandLine: `vegam run --scenario ${scenarioName} --run-id ${runId}`,
              endTimeUtc: new Date().toISOString()
            }
          ],
          results: anomalies.map((pkt) => ({
            ruleId: 'VEGAM-SURPRISAL-HIGH',
            ruleIndex: 0,
            level: pkt.surprisalBits > 8.0 ? 'error' : 'warning',
            message: {
              text: `Anomaly detected at Node '${pkt.nodeId}' (Protocol: ${pkt.protocol}). Total Surprisal = ${pkt.surprisalBits} bits.`
            },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: {
                    uri: `vegam://node/${pkt.nodeId}`
                  },
                  region: {
                    startLine: 1,
                    startColumn: 1
                  }
                },
                logicalLocations: [
                  {
                    name: pkt.nodeId,
                    kind: 'node'
                  }
                ]
              }
            ],
            properties: {
              correlationId: pkt.correlationId,
              surprisalBits: pkt.surprisalBits,
              fieldBreakdown: pkt.fieldBreakdown,
              payloadSnapshot: pkt.payload
            }
          }))
        }
      ]
    };

    await fs.writeFile(outputPath, JSON.stringify(sarif, null, 2), 'utf8');
    console.info(`[SARIFReporter] Successfully written SARIF report: ${outputPath} (${anomalies.length} anomaly findings)`);
  }
}
