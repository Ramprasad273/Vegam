/**
 * Exception thrown when the daily global egress budget has been exhausted.
 */
export class QuotaExhaustedException extends Error {
  constructor(message: string) {
    super(`QuotaExhaustedException: ${message}`);
    this.name = 'QuotaExhaustedException';
  }
}

/**
 * Global Daily Egress Quota Tracker.
 * Tracks total bytes emitted across simulation runs. If total daily egress hits
 * 500 MB/day (governor threshold), trips the circuit breaker and locks into
 * `Local-Only Notice Mode` ($0 bill guarantee).
 */
export class QuotaTracker {
  private static enabled = process.env.VEGAM_GOVERNOR_ENABLED === 'true';
  private static readonly MAX_DAILY_EGRESS_BYTES = 500 * 1024 * 1024; // 500 MB

  private static dailyBytesConsumed = 0;
  private static lastResetTimestamp = Date.now();

  /**
   * Records emitted payload bytes and checks against daily quota.
   * Automatically resets daily counter every 24 hours.
   *
   * @param bytes - Number of bytes emitted or processed.
   * @throws QuotaExhaustedException if the 500 MB cap is reached.
   */
  public static consume(bytes: number): void {
    if (!this.enabled || bytes <= 0) {
      return;
    }

    const now = Date.now();
    // Reset if 24 hours have passed (86,400,000 ms)
    if (now - this.lastResetTimestamp > 86_400_000) {
      this.dailyBytesConsumed = 0;
      this.lastResetTimestamp = now;
      console.info('[QuotaTracker] Daily egress counter reset to 0 bytes.');
    }

    this.dailyBytesConsumed += bytes;

    if (this.dailyBytesConsumed >= this.MAX_DAILY_EGRESS_BYTES) {
      console.error(`[QuotaTracker] Daily egress quota reached: ${this.dailyBytesConsumed} bytes.`);
      throw new QuotaExhaustedException(
        'Daily hosted quota reached. Run locally via Docker for unlimited use.'
      );
    }
  }

  /**
   * Returns current consumed bytes and remaining quota status.
   */
  public static getStatus(): { consumedBytes: number; maxBytes: number; isExhausted: boolean } {
    return {
      consumedBytes: this.dailyBytesConsumed,
      maxBytes: this.MAX_DAILY_EGRESS_BYTES,
      isExhausted: this.enabled && this.dailyBytesConsumed >= this.MAX_DAILY_EGRESS_BYTES
    };
  }

  /**
   * Resets consumed counter (for test suites).
   */
  public static reset(): void {
    this.dailyBytesConsumed = 0;
    this.lastResetTimestamp = Date.now();
  }

  /**
   * Test-only fixture helper to dynamically adjust QuotaTracker Governor protections.
   * @internal
   */
  public static _setGovernorForTests(enabled: boolean): void {
    this.enabled = enabled;
  }
}
