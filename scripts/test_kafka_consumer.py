#!/usr/bin/env python3
"""
Vegam Python Kafka Integration Test Consumer
Requires: pip install kafka-python
"""

import os
import json
import sys
from datetime import datetime

try:
    from kafka import KafkaConsumer
except ImportError:
    print("❌ 'kafka-python' library is missing. Install with: pip install kafka-python")
    sys.exit(1)

def run_consumer():
    brokers = os.getenv("KAFKA_BROKERS", "localhost:19092,localhost:9092").split(",")
    topics = os.getenv("KAFKA_TOPICS", "orders.raw,orders.fulfilled,orders.payment_failed.dlq").split(",")
    group_id = os.getenv("KAFKA_GROUP_ID", f"vegam-python-consumer-{int(datetime.now().timestamp())}")

    print("Starting Vegam Python Kafka Consumer")
    print(f" Brokers : {', '.join(brokers)}")
    print(f" Group ID: {group_id}")
    print(f" Topics  : {', '.join(topics)}")
    print("")

    consumer = KafkaConsumer(
        *topics,
        bootstrap_servers=brokers,
        group_id=group_id,
        auto_offset_reset='latest',
        value_deserializer=lambda m: json.loads(m.decode('utf-8'))
    )

    print("Connected. Listening for synthetic event flow from Vegam...\n")

    message_count = 0
    try:
        for msg in consumer:
            message_count += 1
            key = msg.key.decode('utf-8') if msg.key else "N/A"
            print(f"================ Message #{message_count} [{msg.topic} P:{msg.partition}] ================")
            print(f"🔑 Correlation ID: {key}")
            print(f"📦 Payload       :\n{json.dumps(msg.value, indent=2)}")
            print()
    except KeyboardInterrupt:
        print("\nDisconnecting consumer...")
        consumer.close()
        print("Consumer stopped.")

if __name__ == "__main__":
    run_consumer()
