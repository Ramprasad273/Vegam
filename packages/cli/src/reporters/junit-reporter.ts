import fs from 'node:fs/promises';
import { EventPacket } from '@vegam/engine';

/**
 * JUnit XML Test Reporter (`TEST-vegam-surprisal.xml`).
 * Formats surprisal evaluation runs into standard JUnit test case reports suitable for CI/CD
 * integration (GitHub Actions, Jenkins, GitLab CI). Packets whose surprisal `I(x)` exceeds
 * the threshold are reported as `<failure>` items.
 */
export class JUnitReporter {
  public static async generateReport(
    runId: string,
    scenarioName: string,
    packets: ReadonlyArray<EventPacket>,
    outputPath: string
  ): Promise<void> {
    const totalCount = packets.length;
    const failures = packets.filter((p) => p.isAnomaly);
    const failureCount = failures.length;
    const durationSec = (packets.reduce((sum, p) => sum + (p.executionLatencyMs ?? 0.5), 0) / 1000).toFixed(3);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites name="Vegam Surprisal Verification" time="${durationSec}" tests="${totalCount}" failures="${failureCount}" errors="0">\n`;
    xml += `  <testsuite name="${scenarioName}" id="${runId}" tests="${totalCount}" failures="${failureCount}" time="${durationSec}" timestamp="${new Date().toISOString()}">\n`;

    // Only write up to 1000 testcase tags to prevent giant XML bottlenecks
    const samplePackets = packets.slice(0, 1000);
    for (const pkt of samplePackets) {
      const caseName = `Node: ${pkt.nodeId} | Protocol: ${pkt.protocol} | Corr: ${pkt.correlationId}`;
      xml += `    <testcase name="${this.escapeXml(caseName)}" classname="${pkt.nodeId}" time="0.005">\n`;
      if (pkt.isAnomaly) {
        const failureMsg = `High Surprisal Anomaly Detected: I(x) = ${pkt.surprisalBits} bits (Threshold exceeded)`;
        xml += `      <failure message="${this.escapeXml(failureMsg)}" type="HighSurprisalAnomaly">\n`;
        xml += `<![CDATA[\nEvent Payload:\n${JSON.stringify(pkt.payload, null, 2)}\n\nSurprisal Field Breakdown:\n${JSON.stringify(pkt.fieldBreakdown, null, 2)}\n]]>\n`;
        xml += `      </failure>\n`;
      }
      xml += `    </testcase>\n`;
    }

    xml += `  </testsuite>\n</testsuites>\n`;
    await fs.writeFile(outputPath, xml, 'utf8');
    console.info(`[JUnitReporter] Successfully written JUnit XML report: ${outputPath} (${failureCount} failures / ${totalCount} tests)`);
  }

  private static escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}
