import { EventPacket, SSRFGuard, PortWhitelistGuard } from '@vegam/engine';

export interface EmitResult {
  readonly success: boolean;
  readonly emittedCount: number;
  readonly latencyMs: number;
  readonly errorDetails?: string;
}

export interface HealthStatus {
  readonly isHealthy: boolean;
  readonly protocol: string;
  readonly targetUri: string;
  readonly lastLatencyMs: number;
  readonly details?: string;
}

export interface AuthOptions {
  readonly username?: string;
  readonly password?: string;
  readonly apiKey?: string;
  readonly ssl?: boolean;
}

/**
 * Universal Outbound Connector Interface (`BYOB`).
 */
export interface IOutboundConnector {
  connect(uri: string, auth?: AuthOptions): Promise<void>;
  emitBatch(packets: ReadonlyArray<EventPacket>): Promise<EmitResult>;
  assertHealth(): Promise<HealthStatus>;
  disconnect(): Promise<void>;
}

/**
 * Universal Outbound Connector Pool.
 * Manages active broker sockets across all protocols (Kafka, AMQP, NATS, MQTT, HTTP Webhook).
 * Enforces SSRF and port whitelisting prior to socket instantiation.
 */
export class ConnectorPool {
  private readonly connectors = new Map<string, IOutboundConnector>();

  /**
   * Registers an active outbound connector adapter after verifying safety governance.
   *
   * @param connectorId - Unique identifier (`nodeId` or protocol target).
   * @param targetUri - Destination URI (`localhost:9092`, `amqp://...`).
   * @param connector - Protocol adapter implementing `IOutboundConnector`.
   */
  public async registerConnector(
    connectorId: string,
    targetUri: string,
    connector: IOutboundConnector,
    auth?: AuthOptions
  ): Promise<void> {
    // 1. SSRF & DNS pre-connection check
    await SSRFGuard.assertSafeTarget(targetUri);

    // 2. Port whitelisting check if port is specified
    const portMatch = targetUri.match(/:(\d+)(?:\/|$)/);
    if (portMatch && portMatch[1]) {
      const port = parseInt(portMatch[1], 10);
      PortWhitelistGuard.assertAllowedPort(port);
    }

    await connector.connect(targetUri, auth);
    this.connectors.set(connectorId, connector);
    console.info(`[ConnectorPool] Registered and connected connector: ${connectorId} (${targetUri})`);
  }

  /**
   * Emits a batch of packets through the designated connector.
   */
  public async emitToConnector(
    connectorId: string,
    packets: ReadonlyArray<EventPacket>
  ): Promise<EmitResult> {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      return {
        success: false,
        emittedCount: 0,
        latencyMs: 0,
        errorDetails: `No active connector found for ID: ${connectorId}`
      };
    }
    return await connector.emitBatch(packets);
  }

  /**
   * Runs health checks across all registered outbound sockets.
   */
  public async checkAllHealth(): Promise<Record<string, HealthStatus>> {
    const statusMap: Record<string, HealthStatus> = {};
    for (const [id, connector] of this.connectors.entries()) {
      try {
        statusMap[id] = await connector.assertHealth();
      } catch (err) {
        statusMap[id] = {
          isHealthy: false,
          protocol: 'UNKNOWN',
          targetUri: 'UNREACHABLE',
          lastLatencyMs: -1,
          details: String(err)
        };
      }
    }
    return statusMap;
  }

  /**
   * Disconnects and releases all broker connections.
   */
  public async disconnectAll(): Promise<void> {
    for (const [id, connector] of this.connectors.entries()) {
      try {
        await connector.disconnect();
      } catch (err) {
        console.error(`[ConnectorPool] Error disconnecting ${id}:`, err);
      }
    }
    this.connectors.clear();
    console.info('[ConnectorPool] All outbound sockets disconnected.');
  }
}
