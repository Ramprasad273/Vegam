import { SecurityViolationException } from './ssrf-guard.js';

/**
 * Custom exception thrown when a restricted port connection is attempted.
 */
export class PortBlockedException extends SecurityViolationException {
  constructor(message: string, port: number) {
    super(`PortBlockedException: ${message}`, `Port ${port}`);
    this.name = 'PortBlockedException';
  }
}

/**
 * Port Whitelist Guard.
 * Restricts outbound socket connections specifically to standard message broker ports
 * when running in Hosted Sandbox Mode (`VEGAM_GOVERNOR_ENABLED=true`).
 * Prevents SSH (22), SMTP (25), MySQL (3306), Redis (6379), etc.
 */
export class PortWhitelistGuard {
  private static enabled = process.env.VEGAM_GOVERNOR_ENABLED === 'true';

  /**
   * Standard permitted broker/protocol ports in Vegam Hosted Sandbox Mode.
   */
  private static readonly ALLOWED_PORTS: ReadonlySet<number> = new Set([
    80,    // HTTP Webhook
    443,   // HTTPS Webhook
    1883,  // MQTT Plain
    8883,  // MQTT TLS
    4222,  // NATS Client
    4443,  // NATS TLS / WebSocket
    5671,  // AMQP TLS
    5672,  // AMQP Plain
    9092,  // Kafka / Redpanda Plain
    9093,  // Kafka SSL
    9094,  // Kafka SASL
    18082, // Redpanda Proxy Demo
    19092  // Local Docker Redpanda Demo
  ]);

  /**
   * Asserts that a given target port is explicitly whitelisted for message broker traffic.
   *
   * @param port - The TCP port number to evaluate.
   * @throws PortBlockedException if the port is unauthorized under active governance.
   */
  public static assertAllowedPort(port: number): void {
    if (!this.enabled) {
      return;
    }

    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      console.error(`[PortWhitelistGuard] Invalid port specified: ${port}`);
      throw new PortBlockedException('Port out of valid TCP range (1-65535)', port);
    }

    if (!this.ALLOWED_PORTS.has(port)) {
      console.warn(`[PortWhitelistGuard] Connection attempt to non-broker port denied: ${port}`);
      throw new PortBlockedException(
        `Outbound port ${port} is blocked under Vegam Hosted Governance. Permitted ports: ${Array.from(this.ALLOWED_PORTS).join(', ')}`,
        port
      );
    }
  }

  /**
   * Test-only fixture helper to dynamically adjust Port Whitelist protections.
   * @internal
   */
  public static _setGovernorForTests(enabled: boolean): void {
    this.enabled = enabled;
  }
}
