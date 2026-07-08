# infra

Deployment + local-dev infrastructure: Docker Compose stacks, the Caddyfile
(auto-HTTPS reverse proxy), and deploy scripts.

> **Skeleton only.** Contents land across later foundation tasks:
>
> - **F4** — local `docker-compose.yml` (Postgres + Redis) for dev.
> - **F6** — prod/staging Compose stacks + `Caddyfile` + deploy scripts.
>
> See [`docs/architecture.md`](../docs/architecture.md) §2/§14 and
> [`docs/setup-runbook.md`](../docs/setup-runbook.md).

## Principles (architecture §2, §14)

- App containers (Next.js + Spring Boot behind Caddy) run on the VPS; **managed Postgres
  is never in Compose** — irreplaceable data lives off-box.
- Staging is a second Compose stack on the **same** VPS (separate containers, DB, S3
  prefix, secrets).
- **Secrets via environment only**, never committed.
