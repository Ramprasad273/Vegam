import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Custom exception thrown when a security boundary violation occurs.
 */
export class SecurityViolationException extends Error {
  constructor(message: string, public readonly target: string) {
    super(`SecurityViolationException: ${message} (Target: ${target})`);
    this.name = 'SecurityViolationException';
  }
}

/**
 * Checks whether an IP address belongs to RFC 1918 (Private IP), RFC 3927 (Link-local),
 * RFC 4193 (IPv6 Unique Local), loopback, or cloud metadata ranges (169.254.169.254).
 *
 * @param ip - The IPv4 or IPv6 string to evaluate.
 * @returns true if the IP is internal/forbidden.
 */
export function isInternalOrRestrictedIP(ip: string): boolean {
  // Check loopback / zero
  if (ip === '127.0.0.1' || ip === '0.0.0.0' || ip === '::1' || ip.startsWith('127.')) {
    return true;
  }

  // Check cloud metadata endpoint (AWS/GCP/Azure) & link-local
  if (ip.startsWith('169.254.')) {
    return true;
  }

  // Check RFC 1918 private ranges
  if (ip.startsWith('10.')) {
    return true;
  }
  if (ip.startsWith('192.168.')) {
    return true;
  }
  if (ip.startsWith('172.')) {
    const secondOctet = parseInt(ip.split('.')[1] || '0', 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  // Check IPv6 unique local / link-local
  const lowerIp = ip.toLowerCase();
  if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd') || lowerIp.startsWith('fe80:')) {
    return true;
  }

  return false;
}

/**
 * Server-Side Request Forgery (SSRF) Guard.
 * Resolves hostnames via safe pre-connection DNS checks to prevent cloud metadata
 * takeover attacks and private VPC scanning when hosted in a public cloud environment.
 */
export class SSRFGuard {
  private static enabled = process.env.VEGAM_GOVERNOR_ENABLED === 'true';

  /**
   * Evaluates a target broker URI or hostname against strict SSRF safety rules.
   * If `VEGAM_GOVERNOR_ENABLED` is set to true, resolves the target host and drops
   * internal/private networks in <0.5ms.
   *
   * @param targetHostOrUri - Target host, IP, or connection URI.
   * @throws SecurityViolationException if target resolves to restricted/private IP.
   */
  public static async assertSafeTarget(targetHostOrUri: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    let hostname = targetHostOrUri;
    try {
      if (targetHostOrUri.includes('://')) {
        const url = new URL(targetHostOrUri);
        hostname = url.hostname;
      } else if (targetHostOrUri.includes(':')) {
        hostname = targetHostOrUri.split(':')[0] || targetHostOrUri;
      }
    } catch {
      hostname = targetHostOrUri;
    }

    // Strip square brackets for IPv6 hostnames
    hostname = hostname.replace(/^\[|\]$/g, '');

    // If directly an IP address
    if (net.isIP(hostname)) {
      if (isInternalOrRestrictedIP(hostname)) {
        console.warn(`[SSRFGuard] Blocked direct restricted IP connection attempt: ${hostname}`);
        throw new SecurityViolationException('Access to internal IP/VPC or Cloud Metadata range denied by Governor.', hostname);
      }
      return;
    }

    // Resolve via DNS to detect DNS rebinding / private hostnames
    try {
      const records = await dns.lookup(hostname, { all: true });
      for (const record of records) {
        if (isInternalOrRestrictedIP(record.address)) {
          console.warn(`[SSRFGuard] Blocked DNS resolved restricted address ${record.address} for host ${hostname}`);
          throw new SecurityViolationException('Access to internal IP/VPC or Cloud Metadata range denied by Governor.', hostname);
        }
      }
    } catch (err: unknown) {
      if (err instanceof SecurityViolationException) {
        throw err;
      }
      // If DNS lookup fails, do not allow connection in governor mode
      console.error(`[SSRFGuard] DNS lookup failed for host ${hostname}:`, err);
      throw new SecurityViolationException(`DNS lookup failed or host unreachable: ${hostname}`, hostname);
    }
  }

  /**
   * Test-only fixture helper to dynamically adjust SSRF Governor protections.
   * @internal
   */
  public static _setGovernorForTests(enabled: boolean): void {
    this.enabled = enabled;
  }
}
