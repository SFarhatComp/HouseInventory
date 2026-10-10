FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS base

ENV COREPACK_HOME=/corepack \
    PNPM_HOME=/pnpm \
    XDG_CONFIG_HOME=/etc/xdg \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable \
    && corepack prepare pnpm@12.10.1 --activate \
    && mkdir -p /workspace/node_modules /workspace/apps/web/node_modules \
       /workspace/apps/web/.next/cache /workspace/packages/domain/node_modules /workspace/packages/ui/node_modules \
       /pnpm/store /etc/xdg/pnpm \
    && pnpm config set --global storeDir /pnpm/store \
    && pnpm config set --global packageImportMethod copy \
    && chown -R node:node /workspace /pnpm /etc/xdg/pnpm
WORKDIR /workspace

FROM base AS tools
RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates curl git openssl \
    && rm -rf /var/lib/apt/lists/*
CMD ["pnpm"]

FROM tools AS development
CMD ["sleep", "infinity"]

FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS db-tools
WORKDIR /workspace
RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates curl docker.io postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global supabase@2.120.0 \
    && npm cache clean --force
CMD ["supabase"]

FROM tools AS builder
COPY . .
RUN pnpm install --frozen-lockfile \
    && pnpm --filter @hi/web build

FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs
WORKDIR /app
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
