# CLAUDE.md — working rules for BeeCompete

Read this every session. It's the always-on guardrail; the full reasoning lives in `docs/`.
When in doubt, `docs/` is the source of truth and this file points to it.

## What this project is
A minors-facing, payments-handling marketplace for K-12 academic competitions. **Users are minors and
money moves** — security, privacy, and COPPA compliance are first-class, not afterthoughts.
Start context: `docs/README.md` → `docs/vision-prd.md`, `docs/glossary.md`.

## Non-negotiables
- **Glossary first.** Use the canonical term from `docs/glossary.md` for every name (entity, field, UI
  label). New concept? Add it to the glossary first, then use it.
- **Scope is the registry.** If a feature isn't in `docs/feature-registry.md`, it isn't planned. Respect
  phase order and the 14 foundation hooks.
- **Compliance gates are hard.** Anything touching user data honors COPPA/consent, no student-data
  selling or behavioral ad-targeting to minors, affiliate disclosure with affiliate links. See
  `docs/compliance.md`.
- **Server is the source of truth.** Client validation mirrors server rules for UX; server-side Bean
  Validation + authorization is the real gate. Never trust the client.
- **Secrets via env only**, never committed.

## Architecture rules (`docs/architecture.md`)
- **Modular monolith.** Spring Boot (Java 21) API split into domain modules; cross-module calls go
  through service interfaces. Next.js (TS) web + BFF. Don't reach for microservices.
- **Session-based auth** (Spring Session JDBC → Postgres). **No JWT / refresh-token machinery** (ADR 9).
- **Postgres for everything durable** — sessions and the job queue (JobRunr/db-scheduler,
  `FOR UPDATE SKIP LOCKED`). **Redis is cache + rate-limit counters only** (ADR 10). Never put a
  must-not-lose job in Redis.
- **Neon:** app (incl. job queue) uses the pooled `-pooler` URL; Liquibase migrations use the direct
  URL. Migrations are additive-only.
- **Files** in private S3 via pre-signed URLs — never proxy, never public.

## Data model rules (`docs/domain-model.md`)
- Typed **Spine** columns for anything you filter/sort/join on; validated **JSONB `attributes`** (per
  Category Template JSON Schema) for category-specific fields.
- **Competition ↔ Edition** are separate (evergreen vs. one running). **Region join is Edition-level**
  (`EditionRegion`); one registration = one Edition.
- Progress is **derived from the `ActivityEvent` log** — never add bespoke progress columns.
- `ParticipantProfile` stores **`grad_year`** (grade is derived). Grade encoding: Pre-K −1, K 0, 1–12.
- **Soft-delete** curated data (`archived_at`); corrections go through the `CorrectionProposal` queue.
- **Payer ≠ beneficiary** in entitlements.

## Frontend / design rules (`docs/design-brief.md`, `docs/page-blueprints.md`)
- **All shared UI comes from `packages/ui`.** Search there before creating any component. **Never inline
  SVGs or hand-roll styles** for shared things.
- **Ask the owner for reference images before first-styling any UI element type** (buttons, auth
  pages, dropdowns, modals, …) — **including elements with locked decisions** (re-confirm with
  references; the lock is the fallback). Sole exception: typography (settled 2026-07-08). Record
  supplied references in `docs/design-brief.md` (§1).
- **Mobile-first, fully responsive.** WCAG 2.1 AA on new UI. Light + dark via tokens.
- **Palette:** gold `#F5C330` + ink `#030201`. **Type: display serif for headlines + Inter for
  body/UI** (self-hosted, no font CDN; exact serif face/size/weight = builder judgment at F7 —
  design-brief §3, rev 2026-07-08). **Buttons: pill-rounded, primary = ink fill + white text,
  gold = "brand" variant** (builder-delegated 2026-07-08); cards/dropdowns + expanded panels/
  inputs ≥12–16px radius; **no glow/colored shadows**; owner steers reactively with reference
  photos (design-brief §1).
- Hero pages (Landing, Competitions, Details, How It Works, Categories index, Suggest a Competition)
  follow the approved blueprints; changing their structure means updating `docs/page-blueprints.md` first.

## How we work (`docs/development-process.md`)
- Trunk-based; short-lived branches `feat/<ID>-<slug>`; squash-merge; `main` always deployable behind
  feature flags. Conventional Commits.
- **Two-tier loop.** Full loop (investigate → clarify-if-unclear → plan → 🧑 approve → build → test →
  fresh review → merge) for 🔒/schema/L-XL/new-subsystem work. Light loop (investigate-lite → build →
  test → merge) for small tasks inside existing patterns. **The reuse-scan investigation is never
  skipped** — check `packages/ui` + neighboring modules before writing anything new.
- After ~5–10 light-loop merges and before each release tag, run a `/simplify` or `/code-review` pass.

## 🛑 Hard stops — do NOT design or build ahead
- **Judging** (H12–H17, H25) and the **science-fair compliance system** (HC*) are deliberately not
  designed until their Phase-3 deep-dives (Gate A / Gate B, `docs/development-process.md` §6a). If work
  reaches either gate, **stop and tell the user** — don't research, schema, or implement gated items.
- Reserved/[deferred-design] entities are sketches, not contracts — don't harden them early.

## Repo layout (F1)
pnpm + Turbo monorepo. JS/TS members: `apps/web` (`@beecompete/web`), `packages/ui`
(`@beecompete/ui`), `packages/config` (`@beecompete/config`). `apps/api` is Spring/Gradle (not a
pnpm member). `infra/` (compose + Caddy) and `.github/workflows/` (CI/deploy) fill in later F-tasks.
Root scripts run through Turbo: `pnpm dev|build|lint|typecheck|test|format`. Shared TS config:
`tsconfig.base.json`. Remaining skeletons get filled by F5/F6 (CI/deploy) and F7 (`packages/ui`
design system). Local infra (Postgres + Redis) runs via `infra/docker-compose.yml`.

## Current state
Planning complete. **Foundation in progress.** **F1–F7 done** — F1 monorepo skeleton (pnpm/Turbo,
shared TS/Prettier config, PR template); F2 Spring Boot skeleton (`apps/api`: Java 21, modular
packages, Actuator, Bean Validation, `/api/v1/ping`); F3 Next.js skeleton (`apps/web`: App Router +
TS, Tailwind v4, `@beecompete/ui`/`@beecompete/config` via `transpilePackages`, app shell +
light/dark theming, placeholder logo/icon); F4 persistence baseline (`apps/api`: Spring Data JPA +
PostgreSQL + Liquibase baseline changelog, HikariCP tuned for Neon, Testcontainers integration test;
`infra/docker-compose.yml` = Postgres + Redis; root `.env.example`). No domain entities yet — the
first schema is R1-1; F5 CI (`.github/workflows/ci.yml`: path-filtered web + API build/test, gitleaks
secret scan blocking, Semgrep/Trivy advisory, cached, cancel-in-progress); F6 deploy pipeline
(`apps/{web,api}/Dockerfile`, `infra/docker-compose.{staging,prod}.yml` + `infra/Caddyfile`,
`deploy-staging.yml` on `main`-push + `deploy-prod.yml` on `R*`-tag, build-once-promote to a VPS via
GHCR; images built + run-verified locally, but live deploy needs the VPS/DNS/secrets setup in
setup-runbook §8); F7 design system (`packages/ui`: `styles/tokens.css` = warm semantic light/dark
tokens (no harsh blacks; Claude-style warm dark mode) + Tailwind `@theme`, self-hosted Fraunces +
Inter Variable, pill Button/Input/Textarea/Select/Card/Badge/Logo/ThemeToggle, curated Phosphor
icon re-exports, Vitest tests; live showcase at `/design` in apps/web). Foundation is complete
except **F8** (observability) — next per `docs/phase-1-plan.md`.
