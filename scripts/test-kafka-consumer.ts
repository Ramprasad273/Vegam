import { Kafka } from 'kafkajs';

/**
 * Vegam Kafka Integration Test Consumer
 * 
 * Subscribes to Vegam's synthetic Kafka topics (e.g., orders.raw, orders.fulfilled, orders.payment_failed.dlq)
 * and verifies real-time event flow, correlation IDs, and surprisal payload structure.
 */
async function runConsumer() {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:19092,localhost:9092').split(',');
  const groupId = process.env.KAFKA_GROUP_ID || 'vegam-test-consumer-group-' + Date.now();
  const topics = (process.env.KAFKA_TOPICS || 'orders.raw,orders.fulfilled,orders.payment_failed.dlq').split(',');

  console.log('Starting Vegam Kafka Test Consumer');
  console.log(` Brokers : ${brokers.join(', ')}`);
  console.log(` Group ID: ${groupId}`);
  console.log(` Topics  : ${topics.join(', ')}\n`);

  const kafka = new Kafka({
    clientId: 'vegam-test-consumer',
    brokers: brokers,
    retry: {
      initialRetryTime: 300,
      retries: 8
    }
  });

  const consumer = kafka.consumer({ groupId });

  try {
    await consumer.connect();
    console.log('Connected to Kafka broker successfully!');

    for (const topic of topics) {
      await consumer.subscribe({ topic: topic.trim(), fromBeginning: false });
      console.log(`Subscribed to topic: ${topic.trim()}`);
    }

    let messageCount = 0;
    const startTime = Date.now();

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        messageCount++;
        const elapsedSec = (Date.now() - startTime) / 1000;
        const rate = (messageCount / elapsedSec).toFixed(1);

        const correlationId = message.key ? message.key.toString() : 'N/A';
        const rawPayload = message.value ? message.value.toString() : '{}';
        
        let payload: any = {};
        try {
          payload = JSON.parse(rawPayload);
        } catch {
          payload = rawPayload;
        }

        console.log(`\n================ Message #${messageCount} [${topic} P:${partition}] ================`);
        console.log(`Correlation ID: ${correlationId}`);
        console.log(`Timestamp     : ${new Date(Number(message.timestamp)).toISOString()}`);
        console.log(`Current Rate   : ${rate} msg/sec`);
        console.log(`Payload       :\n${JSON.stringify(payload, null, 2)}`);
      }
    });

    const shutdown = async () => {
      console.log('\nShutting down consumer...');
      await consumer.disconnect();
      console.log('Disconnected cleanly.');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('Error in Kafka consumer:', err);
    process.exit(1);
  }
}

runConsumer();
