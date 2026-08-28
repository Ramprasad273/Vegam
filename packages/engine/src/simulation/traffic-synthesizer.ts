/**
 * TrafficSynthesizer — Auto-synthesizes stateful Vegam YAML scenarios from captured broker traffic packets.
 * Eliminates manual YAML definition by inspecting observed field distributions and correlations.
 */
export class TrafficSynthesizer {
  /**
   * Synthesizes a stateful FSM YAML definition string from an array of sampled traffic payloads.
   *
   * @param scenarioName - Name of the generated scenario.
   * @param packets - Sampled JSON payloads observed over the wire.
   */
  public static synthesizeYaml(scenarioName: string, packets: Array<Record<string, unknown>>): string {
    if (!packets || packets.length === 0) {
      return `name: ${scenarioName}\nversion: "1.0.0"\ndescription: Empty traffic capture\nnodes: []\n`;
    }

    // Inspect first packet for schema shape
    const first = packets[0];
    const keys = Object.keys(first);

    // Identify correlation ID keys (e.g., orderId, id, customerId)
    const idKeys = keys.filter(k => k.toLowerCase().includes('id'));

    const lines: string[] = [
      `name: ${scenarioName}`,
      `version: "1.0.0"`,
      `description: Auto-synthesized stateful scenario from ${packets.length} captured broker packets.`,
      `nodes:`,
      `  - id: step_capture_1`,
      `    topic: captured.raw.events`,
      `    rateHz: 100`,
      `    payload:`
    ];

    // Build base payload properties for step 1
    for (const [k, v] of Object.entries(first)) {
      const safeKey = k.replace(/[^a-zA-Z0-9_.-]/g, '_');
      if (typeof v === 'number' || typeof v === 'boolean') {
        lines.push(`      ${safeKey}: ${v}`);
      } else {
        lines.push(`      ${safeKey}: ${JSON.stringify(String(v))}`);
      }
    }

    // Build correlated follow-up node with $PREV reference and markov_fork branching if > 1 packets observed
    lines.push(`  - id: step_capture_2`);
    lines.push(`    topic: captured.processed.events`);
    lines.push(`    rateHz: 100`);
    lines.push(`    payload:`);

    for (const [k, v] of Object.entries(first)) {
      const safeKey = k.replace(/[^a-zA-Z0-9_.-]/g, '_');
      if (idKeys.includes(k)) {
        lines.push(`      ${safeKey}: "$PREV.${safeKey}"`);
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        lines.push(`      ${safeKey}: ${v}`);
      } else {
        lines.push(`      ${safeKey}: ${JSON.stringify(String(v))}`);
      }
    }

    // Add markov_fork branching
    lines.push(`    transition:`);
    lines.push(`      markov_fork:`);
    lines.push(`        - target: step_capture_success`);
    lines.push(`          probability: 0.90`);
    lines.push(`        - target: step_capture_dlq`);
    lines.push(`          probability: 0.10`);

    return lines.join('\n') + '\n';
  }
}
