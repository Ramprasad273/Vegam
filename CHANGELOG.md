# Changelog

All notable changes to the Vegam project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.1.1] - 2026-08-28

### Fixed
- **Import Order (`test-runner/route.ts`)**: Moved `import assert` above module-level const declarations to conform to ESM conventions and all standard linters.
- **Test Adapter Credential Hygiene (`test-runner/route.ts`)**: Replaced the inline string `'secret-key-123'` with a clearly labelled named constant `TEST_ADAPTER_DUMMY_KEY` to prevent copy-paste of dummy values into production forks.
- **Markov Fallback Branch (`fsm-engine.ts`)**: Fixed floating-point accumulation edge case — fallback now correctly returns the **last** Markov branch (tail of probability distribution) instead of the first when `rand > cumulative sum`.
- **Error Observability (`Workbench.tsx`)**: The `localStorage` parse error catch block now logs the actual caught error object instead of a static string.
- **Docker Stateless Design (`docker-compose.yml`)**: Removed the phantom `/app/data` volume mount (nothing writes there in the current release); added a comment documenting the intentional stateless architecture.
- **SECURITY.md Accuracy**: Clarified credential transmission behaviour — credentials are sent only to the **same Vegam server process** (not any third-party) for outbound broker connectivity, and are held in-memory only for the duration of the request.

### Security
- **`.gitignore` Hardening**: Added exclusions for OS artifacts (`.DS_Store`, `Thumbs.db`), editor files (`.vscode/`, `*.code-workspace`), and internal dev scripts (`oss-cleanup.ps1`) to prevent accidental commits.


## [0.1.0] - 2026-07-23

### Added
- **AI Agent Testing & Surprisal Evaluation Harness**: Added end-to-end support for generating high-throughput synthetic event streams to benchmark autonomous AI agents and event-driven microservices.
- **Real-Time Execution & Latency Telemetry**: Added `executionLatencyMs` property to `EventPacket` tracked via `performance.now()`, plus real network/worker roundtrip tracking in `studio` and `cli`.
- **In-Memory Columnar Telemetry Store (`InMemoryTelemetryStore`)**: High-speed, zero-GC analytical ring buffer backed by `TypedArrays` (`Float64Array`, `Int32Array`) for sub-millisecond p50/p95/p99 latency calculations and time-bucket querying.
- **Surprisal & Anomaly Engine (`SurprisalEngine`)**: Information-theoretic self-information scoring $\mathcal{I}(x) = -\log_2 P(x)$ and Kullback-Leibler (KL) Divergence calculation for edge-case anomaly detection ($>6.0\text{ bits}$).
- **Stateful Markov FSM Engine (`FSMEngine`)**: Multi-step choreography with correlation ID propagation (`$PREV.fieldName`), probability branching (`markov_fork`), and system variable evaluation (`$NOW_MS`, `$NOW_ISO`).
- **Comprehensive Unit & Integration Test Suites**: Standalone `node:assert/strict` unit tests across `engine`, `connectors`, `templates`, and `cli`, with an in-process live verification API endpoint (`POST/GET /api/simulate?mode=test`).
- **SARIF v2.1.0 & JUnit XML Audit Exporters**: Integrated CLI (`vegam export`) reporting for seamless GitHub Security CodeQL alerting and CI/CD automated gating.
- **Five Protocol Adapters**: Full support for Kafka/Redpanda TCP (`9092/19092`), RabbitMQ AMQP 0-9-1 (`5672`), Mosquitto MQTT (`1883`), NATS JetStream Core (`4222`), and HTTP JSON Webhooks.
- **Zero-Code YAML Studio & BYOB Connection Vault**: Interactive Monaco-powered browser studio with local browser profile encryption (`vegam_connection_vault_v1`).
- **Governance & CI/CD**: Standard `Apache-2.0` License, GitHub Issue Templates (`bug_report.md`, `feature_request.md`), and automated GitHub Actions CI workflow (`ci.yml`).

### Changed
- **Renamed Class**: Completely eliminated `DuckDBEngine` across all packages and replaced it with `InMemoryTelemetryStore` to ensure 100% technical honesty and avoid misleading OLAP database claims.
- **Replaced Random Latencies**: Removed all instances of simulated/fabricated metrics (`Math.random()`) in favor of actual wall-clock durations measured at the execution and wire layers.
- **Reframed Positioning**: Updated repository header and Studio UI hero copy from generic IoT simulation to **Synthetic Stress Testing & Surprisal I(x) Evaluation for AI Agents**.

### Security
- **SSRFGuard & PortWhitelistGuard**: Enforced strict DNS pre-resolution blocklists for loopback, link-local, and RFC 1918 private IP ranges, plus strict target port whitelisting, preventing unauthorized internal network scanning.
- **Governor Hardening**: Fixed state management in `VegamGovernor` to eliminate bypass via request payload injection (`governorEnabled`).
- **Credential Storage**: Credentials entered via the Studio UI are no longer persisted to `localStorage`, aligning with strict zero-trust security posture.
