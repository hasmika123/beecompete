# Next.js web app (+ BFF) production image. Multi-stage: build the whole workspace with
# pnpm, then ship only Next's standalone output. Build context is the REPO ROOT (the app
# needs the workspace to resolve @beecompete/*), so build with:
#   docker build -f apps/web/Dockerfile -t beecompete-web .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# --- deps + build ---
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# Browser-side Sentry: NEXT_PUBLIC_* is baked into the client bundle at BUILD time (the
# runtime .env can never reach the browser). Passed by deploy-staging.yml; blank = inert.
# The environment tag is inferred from the hostname at runtime (one image serves both
# staging and prod), so only DSN + release are baked.
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_RELEASE
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_RELEASE=$NEXT_PUBLIC_SENTRY_RELEASE
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @beecompete/web build

# --- runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone output is traced to the repo root, so it mirrors the monorepo layout
# (server.js lives under apps/web/). Static assets and public/ are copied alongside.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# sharp (lib/og-jpeg.ts) is a native module, so it's in serverExternalPackages and stays a plain
# runtime `require`. Next's tracer copies its pnpm store entries into node_modules/.pnpm but NOT
# the symlinks pnpm normally puts beside them, so `require('sharp')` fails with MODULE_NOT_FOUND
# even though every file is present — verified on this image before this step existed. Recreate
# the links (sharp itself plus its @img/* platform packages, which sharp requires by bare name).
# Version-agnostic on purpose: the lockfile stays the single source of truth for which sharp ships.
RUN set -eu; \
    for store in node_modules/.pnpm/sharp@*/node_modules/sharp node_modules/.pnpm/@img+*/node_modules/@img/*; do \
      [ -d "$store" ] || continue; \
      link="node_modules/${store#*/node_modules/}"; \
      mkdir -p "$(dirname "$link")"; \
      ln -sfn "/app/$store" "/app/$link"; \
    done; \
    chown -R nextjs:nodejs node_modules; \
    node -e "require('sharp')" # fail the build here, not in prod, if the links are wrong

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
