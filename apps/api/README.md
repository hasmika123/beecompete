# apps/api — BeeCompete API (Spring Boot, Java 21)

The single deployable backend: a **modular monolith** on Spring Boot (Java 21 LTS),
built with **Gradle**. Not a pnpm workspace member — it builds via Gradle, in the same
monorepo.

> **F2/F4 skeleton.** Spring Boot 3.5 · Java 21 · Gradle (Kotlin DSL) · Undertow · Actuator ·
> Bean Validation · **Spring Data JPA + PostgreSQL + Liquibase** (F4). It boots, serves
> versioned JSON, reports health (incl. DB), and applies the Liquibase baseline on startup —
> **no entities yet** (first schema = R1-1; auth/sessions = R2). See
> [`docs/phase-1-plan.md`](../../docs/phase-1-plan.md) and
> [`docs/architecture.md`](../../docs/architecture.md) §3–§4.

## Run & build

Uses the committed **Gradle wrapper** — no local Gradle install needed. The app targets
**Java 21**; the wrapper's Foojay resolver auto-provisions a JDK 21 toolchain if one isn't
installed (the Gradle daemon itself runs on any JDK ≥ 17).

```bash
cd apps/api
./gradlew build       # compile + test (integration tests use Testcontainers → Docker required)
./gradlew bootRun     # start on http://localhost:8080
```

Wiring checks: `GET /api/v1/ping` (versioned JSON; `?name=` is Bean-Validated) and
`GET /actuator/health` (now includes a `db` component).

**Database:** start Postgres + Redis with `docker compose -f infra/docker-compose.yml up -d`
(see repo-root `.env.example`), then `./gradlew bootRun`. Liquibase applies
`db/changelog/db.changelog-master.yaml` on startup. Migrations are **additive-only** — never
edit a shipped changeset; add a new one under `db/changelog/changes/`.

**Config:** `src/main/resources/application.yml` is committed (no secrets); it reads
`DATABASE_URL` (pooled, app) and `DIRECT_URL` (direct, Liquibase — falls back to the main
datasource when unset). Local overrides go in a git-ignored `application-local.yml`; secrets
via environment only.

## Module layout (domain clusters — architecture §4)

Each module owns its entities, services, and API; **cross-module calls go through
service interfaces** (no reaching into another module's internals).

| Module | Owns |
|---|---|
| `accounts` | users, guardianship, orgs, membership, RBAC, consent |
| `catalog` | competition, edition, category, region, resource |
| `discovery` | search, recommendations |
| `journey` | participant↔competition lifecycle + `ActivityEvent` log |
| `entitlements` | products, orders, Stripe *(Phase 2)* |
| `trust` | verification, provenance, moderation |
| `notifications` | email, reminders |
| `admin` | curation tooling |
| `platform` | files, jobs, flags, config |

**Reserved (do not harden early):** `prep` (Participant+), `host` (registration /
submission / judging — 🛑 Phase-3 design gates).

## Rules (also in root `CLAUDE.md`)

- **Server is the source of truth.** Bean Validation on every DTO + authorization on
  every call is the real gate. Never trust the client.
- **Session-based auth** (Spring Session JDBC → Postgres). No JWT / refresh-token
  machinery (ADR 9).
- **Postgres for everything durable** (sessions + job queue, `FOR UPDATE SKIP LOCKED`);
  Redis is cache + rate-limit counters only (ADR 10).
- Liquibase migrations are **additive-only**; app uses Neon's pooled URL, migrations use
  the direct URL.
- **Secrets via environment only**, never committed.
