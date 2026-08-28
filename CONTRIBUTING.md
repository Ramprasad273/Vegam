# Contributing to Vegam

First off, thank you for considering contributing to Vegam. We are building the "Postman for event-driven systems and AI agents," and community contributions are the lifeblood of our open-source ecosystem.


## Local Development Setup

Vegam uses `pnpm` (v9.0+) and `turbo` for high-speed monorepo builds and task orchestration.

### Prerequisites
- **Node.js**: v22.0.0 or higher
- **pnpm**: v9.15.0 (`npm install -g pnpm`)
- **Docker and Docker Compose**: For local broker testing

### 1. Clone and Install
```bash
git clone https://github.com/vegam-io/vegam.git
cd vegam
pnpm install
```

### 2. Build All Packages
```bash
pnpm run build
```

### 3. Run the Next.js Studio Locally
```bash
pnpm --filter @vegam/studio dev
```
Open `http://localhost:3000` to access the Studio Workbench.


## Code Style and Architecture Guidelines

1. **Core Engineering Principles**: Keep code simple, fast, modular, and zero-fluff. Avoid over-engineering or deep inheritance hierarchies.
2. **TypeScript Strict Mode**: Ensure all packages pass `pnpm run type-check` with no errors.
3. **Docstrings and Comments**: Preserve clear, descriptive comments explaining complex domain logic, especially inside `@vegam/engine` and `$PREV` correlation flows.
4. **Professional UI Quality**: All UI changes inside `@vegam/studio` must maintain our clean, dark-mode, high-contrast engineering aesthetic (Inter/Roboto mono fonts, clear status borders, professional visual hierarchy).


## Testing Your Changes

Before submitting a Pull Request, verify:
```bash
# Type check all workspaces
pnpm run type-check

# Run unit tests across packages
pnpm run test

# Build monorepo production bundles
pnpm run build
```


## Submitting a Pull Request

1. Fork the repository and create your feature branch (`git checkout -b feature/amazing-new-adapter`).
2. Commit your changes with clear, descriptive commit messages (`feat(studio): add NATS JetStream mTLS auth support`).
3. Push to your fork and submit a Pull Request against the `main` branch.
4. Ensure CI checks pass cleanly and describe the exact verification steps in your PR description.
