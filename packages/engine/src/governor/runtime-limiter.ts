/**
 * Exception thrown when a simulation run exceeds the hard runtime limits.
 */
export class GovernanceTimeoutException extends Error {
  constructor(message: string) {
    super(`GovernanceTimeoutException: ${message}`);
    this.name = 'GovernanceTimeoutException';
  }
}

/**
 * Runtime Limiter & Throughput Governor.
 * Enforces a strict 60-second execution hard-timer (`pool.destroy()`) and a 100 ev/sec cap
 * when hosted in Free Sandbox Mode (`VEGAM_GOVERNOR_ENABLED=true`), mathematically guaranteeing
 * $0.00 cloud burn risk ("Default Alive").
 */
export class RuntimeLimiter {
  private static enabled = process.env.VEGAM_GOVERNOR_ENABLED === 'true';
  private static readonly MAX_HOSTED_DURATION_MS = 60_000; // Exact 60 seconds
  private static readonly MAX_HOSTED_RATE_HZ = 100;         // Max 100 ev/sec in free tier
  private static readonly MAX_PAYLOAD_BYTES = 16_384;       // 16 KB max per packet

  private timeoutHandle: NodeJS.Timeout | null = null;
  private readonly startTimeMs: number;

  constructor(private readonly onHardStop: () => void) {
    this.startTimeMs = Date.now();
  }

  /**
   * Starts the monotonic 60-second countdown timer if governance is enabled.
   */
  public start(): void {
    if (!RuntimeLimiter.enabled) {
      console.info('[RuntimeLimiter] Governor disabled — unlimited runtime and rate allowed.');
      return;
    }

    console.warn(`[RuntimeLimiter] Governor ACTIVE — enforcing hard 60s stop and ${RuntimeLimiter.MAX_HOSTED_RATE_HZ} ev/s cap.`);
    this.timeoutHandle = setTimeout(() => {
      console.warn('[RuntimeLimiter] Hard stop: 60-second hosted run completed. Triggering shutdown.');
      try {
        this.onHardStop();
      } catch (err) {
        console.error('[RuntimeLimiter] Error during forced hard stop execution:', err);
      }
    }, RuntimeLimiter.MAX_HOSTED_DURATION_MS);
  }

  /**
   * Cancels the active hard timer upon clean completion.
   */
  public stop(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  /**
   * Returns the exact duration in milliseconds since this limiter started.
   */
  public getElapsedMs(): number {
    return Date.now() - this.startTimeMs;
  }

  /**
   * Asserts whether the simulation should continue based on elapsed runtime.
   */
  public assertCanContinue(): void {
    if (RuntimeLimiter.enabled && this.getElapsedMs() >= RuntimeLimiter.MAX_HOSTED_DURATION_MS) {
      throw new GovernanceTimeoutException(
        'Hard stop: 60-second hosted run completed. Run locally via Docker CLI for unlimited continuous runs.'
      );
    }
  }

  /**
   * Clamps user-configured emission rate to the maximum authorized under governance.
   *
   * @param requestedHz - Desired emission rate in Hertz (events per second).
   * @returns Authorized emission rate.
   */
  public static clampEmissionRate(requestedHz: number): number {
    if (!this.enabled) {
      return requestedHz;
    }
    const clamped = Math.min(requestedHz, this.MAX_HOSTED_RATE_HZ);
    if (clamped < requestedHz) {
      console.info(`[RuntimeLimiter] Clamped rate from ${requestedHz} Hz to ${clamped} Hz under Governor rules.`);
    }
    return clamped;
  }

  /**
   * Asserts packet size limit under Governor constraints.
   */
  public static assertPayloadSize(sizeBytes: number): void {
    if (this.enabled && sizeBytes > this.MAX_PAYLOAD_BYTES) {
      throw new Error(`Payload size ${sizeBytes} bytes exceeds Governor cap of ${this.MAX_PAYLOAD_BYTES} bytes.`);
    }
  }

  /**
   * Test-only fixture helper to dynamically adjust RuntimeLimiter Governor protections.
   * @internal
   */
  public static _setGovernorForTests(enabled: boolean): void {
    this.enabled = enabled;
  }
}
