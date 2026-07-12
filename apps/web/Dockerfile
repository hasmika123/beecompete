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

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
