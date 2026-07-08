# apps/api — BeeCompete API (Spring Boot, Java 21)

The single deployable backend: a **modular monolith** on Spring Boot (Java 21 LTS),
built with **Gradle**. Not a pnpm workspace member — it builds via Gradle, in the same
monorepo.

> **Skeleton only.** The Spring Boot project (Gradle, Actuator, Bean Validation, the
> module packages below) is scaffolded in **F2**. Postgres + Liquibase baseline is **F4**.
> See [`docs/phase-1-plan.md`](../../docs/phase-1-plan.md) and
> [`docs/architecture.md`](../../docs/architecture.md) §4.

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
