FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV VEGAM_GOVERNOR_ENABLED=true
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup -S vegam && adduser -S vegam -G vegam

# Standalone lean deployment pattern (drops unneeded devDependencies & source files)
COPY --from=builder --chown=vegam:vegam /app/packages/studio/.next/standalone ./
COPY --from=builder --chown=vegam:vegam /app/packages/studio/.next/static ./packages/studio/.next/static
COPY --from=builder --chown=vegam:vegam /app/packages/studio/public ./packages/studio/public

USER vegam

EXPOSE 3000
CMD ["node", "packages/studio/server.js"]

