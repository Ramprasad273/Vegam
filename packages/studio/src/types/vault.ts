export interface ConnectionProfile {
  id: string;
  name: string;
  protocol: 'KAFKA' | 'AMQP' | 'MQTT' | 'NATS' | 'WEBHOOK' | 'HTTP';
  bootstrapServers: string;
  authType: 'NONE' | 'SASL_PLAIN' | 'SASL_SCRAM_256' | 'MTLS';
  apiKey?: string;
  apiSecret?: string;
  isCustom?: boolean;
  createdAt?: number;
}

export const DEFAULT_CONNECTION_PROFILES: ConnectionProfile[] = [
  {
    id: 'default-redpanda-kafka',
    name: 'Local Redpanda Kafka Cluster',
    protocol: 'KAFKA',
    bootstrapServers: 'localhost:19092',
    authType: 'NONE',
    isCustom: false,
  },
  {
    id: 'default-rabbitmq-amqp',
    name: 'Local RabbitMQ AMQP 0-9-1 Broker',
    protocol: 'AMQP',
    bootstrapServers: 'localhost:5672',
    authType: 'SASL_PLAIN',
    apiKey: 'vegam',
    apiSecret: 'vegam_secret',
    isCustom: false,
  },
  {
    id: 'default-mosquitto-mqtt',
    name: 'Local Mosquitto MQTT v3.1.1 Broker',
    protocol: 'MQTT',
    bootstrapServers: 'localhost:1883',
    authType: 'NONE',
    isCustom: false,
  },
  {
    id: 'default-nats-jetstream',
    name: 'Local NATS JetStream 2.10+ Core',
    protocol: 'NATS',
    bootstrapServers: 'localhost:4222',
    authType: 'NONE',
    isCustom: false,
  },
];
