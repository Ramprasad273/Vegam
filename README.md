# Vegam - Synthetic Event Generation and Simulation Framework

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/vegam-io/vegam)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Terms of Use](https://img.shields.io/badge/Legal-Terms%20of%20Use-red.svg)](TERMS_OF_USE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Vegam is an open-source, multi-protocol synthetic data generator designed to simulate stateful, correlated event flows across distributed message brokers. By defining multi-step scenarios, developers can evaluate distributed architectures, stream processors, and event-driven applications with realistic traffic and anomalies.

## Overview

Unlike standard mock generators that emit stateless payloads, distributed microservices require correlated multi-topic transaction flows over time. For example, an event arriving at an order ingestion topic requires a subsequent fulfillment packet with a matching correlation ID on a downstream topic, or a correctly formatted failure payload routed to a Dead Letter Queue (DLQ).

Vegam provides a framework to define these finite state machine (FSM) sequences and execute them directly against your integration environment.

## Core Capabilities

### 1. Multi-Protocol Broker Integration
Connect Vegam to your local or staging brokers using standard connection configurations:
- **Supported Protocols:** Kafka, Redpanda TCP (9092/19092), RabbitMQ AMQP 0-9-1 (5672), Mosquitto MQTT (1883), NATS JetStream Core (4222), and HTTP JSON Webhooks.
- **Enterprise Security:** Support for Plaintext, SASL_PLAIN + SSL, SASL_SCRAM-SHA-256, and mTLS custom certificates.

### 2. Scenario Definition and YAML Studio
Define stateful event scenarios visually or via YAML configuration:
- Use probabilistic branching for different event outcomes (e.g., success vs. DLQ).
- Inherit variables and correlation IDs across sequential steps using variable references.
- Leverage pre-packaged templates for standard industry domains (e-commerce, financial ledgers, and billing).

### 3. Statistical Anomaly Injection
Evaluate system resilience by automatically generating statistical outliers based on anomaly scoring metrics. Exceeding predefined thresholds triggers configurable network delays, DLQ rerouting, or schema mutations to validate exception handling logic.

### 4. CI/CD Integration and Static Analysis
Run headless stress tests and output exact static analysis logs in OASIS SARIF v2.1.0 format or JUnit XML for integration into CI/CD pipelines.

## Quickstart

Start the local Vegam Studio and bundled multi-protocol brokers via Docker Compose:

```bash
# 1. Clone the repository
git clone https://github.com/vegam-io/vegam.git
cd vegam

# 2. Start the complete local studio and broker suite via Docker Compose
docker-compose up -d

# 3. Open the UI Workbench in your browser
open http://localhost:3000
```

## Architecture

The project is structured as a monorepo containing modular packages for core logic, protocol adapters, and presentation layers:

```text
vegam/
├── packages/
│   ├── engine/       # Core stateful FSM graph evaluation and synthesis engine
│   ├── connectors/   # Protocol adapters (Kafka, AMQP, NATS, MQTT, HTTP Webhooks)
│   ├── templates/    # Pre-packaged domain scenarios
│   ├── cli/          # Headless terminal CLI for automation and CI/CD
│   └── studio/       # Next.js Web Workbench and visual editor
├── docker/           # Production container definitions
└── docker-compose.yml # Local orchestration configuration
```

## Command Line Interface (CLI)

Run end-to-end simulations and interactive dashboards directly in your terminal:

### Interactive Terminal Dashboard
Monitor real-time anomaly metrics and DLQ events:

```bash
node packages/cli/dist/cli.js tui \
  --template fintech-fraud-v1 \
  --rate 50 \
  --duration 10
```

### Headless Simulation for CI/CD
Execute headless stress runs and export audit trails:

```bash
node packages/cli/dist/cli.js run \
  --template ecommerce-checkout-v1 \
  --rate 200 \
  --duration 60

# Export findings to OASIS SARIF v2.1.0 format
node packages/cli/dist/cli.js export \
  --template fintech-fraud-v1 \
  --output vegam-audit.sarif \
  --format sarif
```

## Contributing

We welcome contributions from the community. Please review the following documentation before submitting pull requests:
- **Contributing Guide:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Code of Conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- **Issue Tracker:** Submit bug reports, feature suggestions, or security inquiries on the official repository tracker.

## Terms of Use and Legal Disclaimer

**IMPORTANT NOTICE:** By installing, running, or connecting this Software to any network target, you explicitly accept our comprehensive [Terms of Use and Liability Disclaimer](TERMS_OF_USE.md).

- **No Liability for Infrastructure Damages:** The Vegam project creators and maintainers assume ZERO LIABILITY for any damages arising from your use of this Software, including network disruption, server downtime, or third-party service degradation.
- **Authorized Testing Only:** You are strictly prohibited from using Vegam to interact with any infrastructure where you do not possess explicit authorization from the owner.
- **Indemnification:** You agree to fully indemnify the maintainers from any claims resulting from your deployment or misuse of the Software.

## License

Vegam is open-source software licensed under the [Apache License 2.0](https://opensource.org/licenses/Apache-2.0).
