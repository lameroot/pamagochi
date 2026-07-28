# syntax=docker/dockerfile:1
# Root-level convenience copy of infra/cloud/api.Dockerfile, kept for tools
# that only look for a Dockerfile at the repository root. Koyeb is
# explicitly configured to use infra/cloud/api.Dockerfile as its custom
# Dockerfile path (see infra/cloud/koyeb.md) — that file is the source of
# truth; keep both in sync when changing the API build.
#
# Build context MUST be the monorepo root so that the root package.json,
# pnpm-lock.yaml, pnpm-workspace.yaml and all workspace packages
# (contracts, database, game-core) are visible.

ARG NODE_IMAGE=node:24.18.0-bookworm-slim

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# pnpm needs every workspace package.json present to compute the full
# dependency graph and validate it against pnpm-lock.yaml, even though the
# actual `install` below is scoped (--filter) to just apps/api and its
# workspace dependencies. Copying only a subset of package.json files here
# causes pnpm to silently diverge from the lockfile.
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/game-core/package.json packages/game-core/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY tests/e2e/package.json tests/e2e/package.json
RUN pnpm install --frozen-lockfile \
  --filter @pamagochi/api \
  --filter @pamagochi/contracts \
  --filter @pamagochi/database \
  --filter @pamagochi/game-core

# ---------------------------------------------------------------------------
FROM dependencies AS builder
COPY tsconfig.base.json turbo.json ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts
COPY packages/database packages/database
COPY packages/game-core packages/game-core

# Re-link workspace node_modules: depending on the Docker builder in use,
# copying full package sources over the package.json-only directories from
# the `dependencies` stage can clobber the per-package node_modules
# symlinks pnpm created earlier. Everything needed is already in the local
# pnpm store from the previous install, so this is fast and fully offline.
RUN pnpm install --offline --frozen-lockfile \
  --filter @pamagochi/api \
  --filter @pamagochi/contracts \
  --filter @pamagochi/database \
  --filter @pamagochi/game-core

RUN pnpm --filter @pamagochi/database run prisma:generate
RUN pnpm --filter @pamagochi/contracts run build
RUN pnpm --filter @pamagochi/game-core run build
RUN pnpm --filter @pamagochi/database run build
RUN pnpm --filter @pamagochi/api run build

# Prune devDependencies in place (rather than `pnpm deploy`, which builds a
# brand new virtual store and can end up linking a *different*, not-yet-
# `prisma generate`-d copy of @prisma/client than the one used above).
RUN pnpm prune --prod

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system pamagochi && useradd --system --gid pamagochi --home-dir /app pamagochi

# The workspace packages are consumed via symlinks inside node_modules
# (`node_modules/@pamagochi/contracts -> ../../packages/contracts`), so the
# runtime image must preserve the same relative directory layout as the
# builder, not just the flattened dist output of apps/api.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=builder /app/packages/game-core/package.json ./packages/game-core/package.json
COPY --from=builder /app/packages/game-core/dist ./packages/game-core/dist
COPY --from=builder /app/packages/game-core/node_modules ./packages/game-core/node_modules

USER pamagochi

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || process.env.API_PORT || 3000) + '/api/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
