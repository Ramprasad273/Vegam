import { FSMEngine, SimulationNodeConfig, EventPacket } from '../src/simulation/fsm-engine.js';

async function runBenchmark() {
  console.log('--- Vegam Engine Benchmark ---');
  
  const nodes: SimulationNodeConfig[] = [
    {
      nodeId: 'checkout-root',
      nodeName: 'Checkout',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'checkout.events',
      emissionRateHz: 1000,
      synthesisRules: [
        { fieldName: 'orderId', ruleExpression: '"ORD-" + $PREV.id' },
        { fieldName: 'amount', ruleExpression: 'gaussian(100, 20)' },
        { fieldName: 'currency', ruleExpression: 'weighted(["USD", "EUR"])' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' }
      ]
    }
  ];

  console.log('Initializing FSM Engine with 1000 Hz target rate...');
  const engine = new FSMEngine(nodes);
  
  const iterations = 50000;
  console.log(`Synthesizing ${iterations} events...`);
  
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const parentPacket = { payload: { id: `SEQ-${i}` } } as any;
    engine.stepNode('checkout-root', parentPacket);
  }
  const end = performance.now();
  
  const durationMs = end - start;
  const evPerSec = Math.floor(iterations / (durationMs / 1000));
  
  console.log(`\nResults:`);
  console.log(`Total Time: ${durationMs.toFixed(2)} ms`);
  console.log(`Throughput: ${evPerSec.toLocaleString()} events/sec`);
  console.log(`Average Latency: ${(durationMs / iterations).toFixed(4)} ms/event`);
}

runBenchmark().catch(console.error);
