# Security Policy

## Supported Versions

Only the latest major release of Vegam receives active security updates and vulnerability patches:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

We take the security of Vegam, its FSM simulation core, and its broker connection vault very seriously. If you believe you have found a security vulnerability, **do not open a public GitHub issue**.

Please report security vulnerabilities directly to the maintainers via email at:
`security@vegam.io`

### What to include in your report:
1. **Description**: A detailed summary of the vulnerability and its potential impact.
2. **Reproduction Steps**: Step-by-step instructions, YAML scenario configurations, or proof-of-concept scripts to reproduce the issue.
3. **Environment**: Affected OS, Node.js version, and target broker wire protocol.

### Response Timeline:
- **Acknowledgement**: Within 48 hours of initial report submission.
- **Triage & Assessment**: Within 5 business days.
- **Fix & Advisory**: We aim to release patches and publish a GitHub Security Advisory within 30 days of confirmed triage.

---

## Architectural Security Best Practices (`SSRFGuard` & `RuntimeLimiter`)

Vegam includes built-in security barriers designed to protect platform infrastructure from abuse when hosted as a web studio or CI/CD test runner:

1. **Server-Side Request Forgery (`SSRFGuard`)**:
   - Outbound HTTP adapters and webhook targets undergo pre-connection IP resolution.
   - Private RFC 1918 networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback addresses (`127.0.0.1/8`, `::1`), and cloud provider metadata endpoints (`169.254.169.254`) are strictly blocked when `governorEnabled: true`.

2. **Runtime Rate & Payload Limiting (`RuntimeLimiter`)**:
   - To prevent accidental Denial of Service (DoS) against production brokers or $0 cloud free-tier bill shock, Vegam enforces hard emission rate limits (`<= 100 Hz` default in UI) and payload size clamping (`<= 16 KB` per packet, `64 KB` max HTTP body).

3. **Client-Side Connection Vault & Credential Hygiene**:
   - Connection profiles and broker targets are managed client-side. Sensitive authentication credentials (passwords, HMAC secrets, API keys) are **never persisted in plaintext** to browser localStorage.
   - When a user configures a live broker connection and starts a simulation, credentials are transmitted **only to the Vegam server API** (i.e., the same host serving the Studio UI) for the purpose of establishing the outbound broker socket. Credentials are never forwarded to or stored by any third-party external server.
   - In Railway/Render hosted deployments, credentials are transmitted to the Vegam server process on the same deployment and held only in-memory for the duration of the request.

4. **Multi-Tenant State Isolation**:
   - Simulation state and telemetry ring buffers are strictly scoped per execution run to prevent cross-request contamination in multi-tenant or serverless hosting environments.
