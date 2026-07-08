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

> **Still skeleton:** prod/staging Compose stacks + `Caddyfile` + deploy scripts land in
> **F6**. See [`docs/architecture.md`](../docs/architecture.md) §2/§14 and
> [`docs/setup-runbook.md`](../docs/setup-runbook.md).

## Principles (architecture §2, §14)

- App containers (Next.js + Spring Boot behind Caddy) run on the VPS; **managed Postgres
  is never in Compose** — irreplaceable data lives off-box. This local stack is a dev
  convenience only.
- Redis holds **cache + rate-limit counters only** — nothing durable (ADR 10), so it runs
  without a persistence volume.
- Staging is a second Compose stack on the **same** VPS (separate containers, DB, S3
  prefix, secrets).
- **Secrets via environment only**, never committed.
