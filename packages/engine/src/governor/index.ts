export * from './ssrf-guard.js';
export * from './port-whitelist.js';
export * from './runtime-limiter.js';
export * from './quota-tracker.js';

import { SSRFGuard } from './ssrf-guard.js';
import { PortWhitelistGuard } from './port-whitelist.js';
import { RuntimeLimiter } from './runtime-limiter.js';
import { QuotaTracker } from './quota-tracker.js';

/**
 * Global Governor Manager for Vegam engine.
 * Allows toggling hosted safety barriers across all sub-modules simultaneously.
 */
export class VegamGovernor {
  /**
   * Sets the global governor enforcement state across SSRF, Port Whitelist,
   * Runtime Limiter, and Quota Tracker.
   *
   * @param enabled - true if running on public hosted tier (play.vegam.io)
   */
  public static setEnabled(enabled: boolean): void {
    SSRFGuard._setGovernorForTests(enabled);
    PortWhitelistGuard._setGovernorForTests(enabled);
    RuntimeLimiter._setGovernorForTests(enabled);
    QuotaTracker._setGovernorForTests(enabled);
    console.info(`[VegamGovernor] Safety barriers ${enabled ? 'enabled' : 'disabled'}.`);
  }

  /**
   * Returns whether the governor safety barriers are currently active.
   */
  public static isEnabled(): boolean {
    return process.env.VEGAM_GOVERNOR_ENABLED === 'true';
  }
}
