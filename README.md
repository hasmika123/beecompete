# BeeCompete

A cross-vertical discovery marketplace, prep platform, and host toolkit for K-12 academic
competitions — "every competition worth entering, one place, always current."

> **Status:** Planning complete; pre-flight setup in progress. No application code yet.
> The full plan lives in **[`docs/`](docs/README.md)** — start with
> [vision-prd.md](docs/vision-prd.md) and [glossary.md](docs/glossary.md).

## What this is
Three facets, built in phases:
1. **Marketplace** (free) — discover & track competitions across every K-12 subject.
2. **Participant+** (paid) — per-competition prep.
3. **Host Tools** (paid) — run a competition; the science-fair wedge is the Phase-3 anchor.

## Planned structure (monorepo)
```
/apps/web         Next.js 16 (App Router, TS) — web + BFF
/apps/api         Spring Boot (Java 21, Gradle) — modular monolith
/packages/ui      shared design system (tokens, components) — consumed as source
/packages/config  shared config/types
/infra            Docker Compose, Caddyfile, deploy scripts
/.github/workflows  ci.yml, deploy.yml
/docs             planning corpus
```
*(apps/packages/infra scaffolded in task F1 — see [phase-1-plan.md](docs/phase-1-plan.md).)*

## Stack (see [architecture.md](docs/architecture.md))
Next.js · Spring Boot · PostgreSQL (managed/Neon) · Redis (cache only) · S3 · Stripe · Cloudflare ·
session-based auth · self-hosted VPS + Docker Compose + Caddy.

## Working here
- **Conventions & guardrails:** [`CLAUDE.md`](CLAUDE.md) (read every session).
- **Process:** [development-process.md](docs/development-process.md) — trunk-based, two-tier feature loop, feature flags, tagged releases.
- **Releases:** R0 waitlist → R1 browse-only → R2 accounts → R3 Participant+ → R4 Host Tools → R5 judging/institutional.
