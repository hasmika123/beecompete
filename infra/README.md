# infra

Deployment + local-dev infrastructure: Docker Compose stacks, the Caddyfile
(auto-HTTPS reverse proxy), and deploy scripts.

## Local dev (F4)

`docker-compose.yml` runs **Postgres + Redis** for local development:

```bash
docker compose -f infra/docker-compose.yml up -d      # start
docker compose -f infra/docker-compose.yml down       # stop (keeps the pgdata volume)
docker compose -f infra/docker-compose.yml down -v     # stop + wipe the DB volume
```

Config comes from the repo-root `.env` (copy `.env.example`). Defaults: Postgres on
`localhost:5432` (db/user/pass `beecompete`), Redis on `localhost:6379`. The Spring API
reads `DATABASE_URL`; Liquibase applies the baseline changelog on startup. Integration
tests use Testcontainers, so they need Docker running but **not** this compose stack.

## Deploy stacks (F6)

- **`docker-compose.edge.yml`** — the **shared edge stack**: a single Caddy that owns
  80/443 for the whole box and reverse-proxies **by hostname** to each app/env's web
  container over the shared external `web_edge` Docker network. This is the only thing on
  80/443 — per-env stacks no longer run their own Caddy (that would collide on the ports).
  Static infra, brought up manually; `web_edge` must exist first (`docker network create
  web_edge`).
- **`docker-compose.staging.yml`** / **`docker-compose.prod.yml`** — the per-env app stacks:
  **web + api only**, images pulled from **GHCR**. Their `web` joins `web_edge` under an
  alias (`staging-web` / `prod-web`) so the edge Caddy can reach it; the API stays private on
  each stack's `internal` network. Managed Postgres stays **off-box** (never in these files).
  Deployed by the `deploy-*.yml` workflows; a sibling `.env` on the VPS holds each
  environment's secrets (`DATABASE_URL`, `DIRECT_URL`, `SENTRY_DSN`, …).
- **`Caddyfile`** — belongs to the edge stack; one site block per hostname
  (`staging.beecompete.com`, `beecompete.com`, `www` → apex redirect). Auto-HTTPS. Only web
  containers are public (BFF pattern — the API is internal on the Docker network). Adding an
  app = a new site block + that app's web on `web_edge` + `caddy reload`.
- **`apps/web/Dockerfile`** / **`apps/api/Dockerfile`** — build from the **repo root** as
  context (`docker build -f apps/web/Dockerfile .`).

**Flow (build once, promote):** merge to `main` → `deploy-staging.yml` builds `:sha` images
and refreshes staging. A release tag (`git tag R1 && git push origin R1`) → `deploy-prod.yml`
*re-tags the exact tested image* and refreshes prod. Liquibase migrates on API startup
(DIRECT_URL); the deploy waits for `/actuator/health` = UP before finishing.

**Manual rollback:** re-run `deploy-prod.yml` (workflow_dispatch) with the previous known-good
12-char image tag, or on the VPS: `export IMAGE_TAG=<prev>; docker compose -f
docker-compose.prod.yml up -d`.

> **Still skeleton:** first-time VPS/DNS/secret setup is a manual runbook — see
> [`docs/setup-runbook.md`](../docs/setup-runbook.md) §8. Architecture context:
> [`docs/architecture.md`](../docs/architecture.md) §2/§14.

## Principles (architecture §2, §14)

- App containers (Next.js + Spring Boot behind Caddy) run on the VPS; **managed Postgres
  is never in Compose** — irreplaceable data lives off-box. This local stack is a dev
  convenience only.
- Redis holds **cache + rate-limit counters only** — nothing durable (ADR 10), so it runs
  without a persistence volume.
- Staging is a second Compose stack on the **same** VPS (separate containers, DB, S3
  prefix, secrets).
- **Secrets via environment only**, never committed.
