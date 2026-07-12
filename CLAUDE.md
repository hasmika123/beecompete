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
GHCR; **now LIVE on IONOS** — see the DEPLOYED note at the end of this section); F7 design system (`packages/ui`: `styles/tokens.css` = warm semantic light/dark
tokens (no harsh blacks; Claude-style warm dark mode) + Tailwind `@theme`, self-hosted Fraunces +
Inter Variable, ~20 primitives — Button/Input/Textarea/Select/Card/Badge/Chip/Checkbox/Radio/
FormField/Avatar/Alert/Skeleton/Spinner/EmptyState/Tooltip/Tabs (underline + attached folder-tab)/
Modal/Toast/Logo/ThemeToggle, curated Phosphor icon re-exports, Vitest tests; approved
CompetitionCard direction + live showcase at `/design` in apps/web); F8 observability
(Sentry error capture on web + api, env-driven/inert without a DSN, **no PII/no Session Replay** for
COPPA; structured JSON logs via `logback-spring.xml` json profile — on in the deploy stacks). **All
foundation tasks F1–F8 are done.** **R1-1 done (2026-07-12):** core catalog schema — Liquibase
`0002`–`0004` + JPA entities/repositories in the `catalog` module (13 tables: Competition, Edition,
EditionRegion, KeyDate, Category, CategoryTemplate, Region, Resource, CompetitionFaq,
CorrectionProposal, HeroCard, FeaturedSlot, **Organization** — pulled into R1 for card/details
organizer attribution + DQ13); `competition.summary` card blurb; `updated_at` + `@Version`
optimistic locking on curated tables; region natural key; as-built decisions + the binding
**effective-status rule** recorded in `docs/domain-model.md` §8; Hibernate `ddl-auto: validate` on
every boot; API on default Tomcat (Undertow dropped — deprecated in Boot 3.5). **R1-2 done
(2026-07-12):** the 11 launch categories (Q1 list) + one permissive Category Template JSON Schema
each, seeded via Liquibase `0005` (fixed `beec0000-…` UUIDs), plus `CategoryAttributeValidator`
(networknt, draft 2020-12) — every attributes-bag write (R1-3 admin, S3 pipeline) must validate
through it. **R1-3 done (2026-07-12) — admin curation tooling v0** (2 PRs): **R1-3a** the admin
API (`catalog.curation` module → `/api/v1/admin/**`: CRUD for Competition/Edition/KeyDate/Resource/
Category(+template)/Organization, import-review queue on a new `import_record` table — Liquibase
`0006` — approve→creates the record with `provenance.source=import`, landing content HeroCard/
FeaturedSlot with the ≤10 cap, verification/provenance controls; every write stamps provenance);
**R1-3b** the `/admin` web UI (Next App Router, **server components + server actions**, BFF —
the `ADMIN_API_TOKEN` lives server-side only, browser→Next→API with `X-Admin-Token`). **Admin auth
(R1 stopgap):** shared-secret `AdminTokenFilter` (fail-closed, URL-pattern-scoped so `%61dmin`
can't bypass) + Cloudflare Access on the browser route; migrates to real RBAC at **R2-7**. Also:
`ApiExceptionHandler` maps 409/422 + echoes explicit reasons (Spring hides messages by default);
public web pages moved into an `app/(public)` route group so `/admin` has its own shell. As-built
detail in `docs/architecture.md` §13a. **R1-3b done (2026-07-12) — corrections intake + review**
(DQ6): public `POST /api/v1/corrections` (outside the admin filter; per-subject-type **field
whitelist** in `CorrectionFields` enforced at intake AND approve — no slug/category/organizer ids,
no `attributes` — plus subject-existence gate, size caps, web-form honeypot; real rate-limit =
edge WAF at R1-17) → `CorrectionProposal` queue (R1-1 table, no migration) → `/admin/corrections`
review UI (current-vs-proposed panel, edit-then-approve, reject) → **approve applies the diff
through the curation write path** (merge → Bean-validate → provenance restamped `curated`;
`EditionRequest`/`ResourceRequest` promoted to `catalog.curation`, `Edition/ResourceCurationService`
extracted). R1 audit record = the reviewed proposal row (submitter note kept; curator activity
appended as `[curator]` lines); ActivityEvent logging waits for R2-9. Public form at
`/suggest-a-correction` (noindex) — detail pages link to it at R1-7. **R1-4 done (2026-07-12) —
public catalog read API** (M5/M6/DQ1): `catalog.web` → `GET /api/v1/competitions` (paged,
name-sorted browse feed) + `GET /api/v1/competitions/{slug}` (detail: editions + key dates +
regions + resources + FAQs + organizer). Archived invisible (D7), verification/provenance exposed
(DQ13), **lowercase public enum tokens**, and **`effectiveStatus`** computed by
`catalog.service.EffectiveStatus` per the binding domain-model §8 rule. As-built for both:
`docs/architecture.md` §13b. Next per `docs/phase-1-plan.md`: **R1-5 search & filter API** or
**R1-6/R1-6b frontend**; **S2/S3 seeding** can run in parallel — S3's extractor POSTs into the
import queue R1-3 built. **Deferred (PR C):** S3 pre-signed hero-image upload + inline FAQ/
Resource row-edit. **Before prod users:** set `ADMIN_API_TOKEN` in both VPS `.env` + `/admin`
behind Cloudflare Access (setup-runbook §5).
Remaining F8 operational steps (uptime monitor + confirming Sentry receives events) are done after
staging is live — see setup-runbook §9.

**DEPLOYED (2026-07-12):** staging + production are **LIVE** on an **IONOS VPS** (US East, Ubuntu 24.04)
behind a **single shared edge Caddy** — `https://beecompete.com` (+ `www`→apex) and
`https://staging.beecompete.com`. Infra is `infra/docker-compose.{edge,staging,prod}.yml` +
`infra/Caddyfile` (edge stack owns 80/443 on the `web_edge` network; per-stack files run web+api only).
The F6 pipeline is active — staging on `main` push, prod on an `R*` tag (build-once-promote). Provider
switched Hetzner→IONOS (D11); shared edge Caddy is D13. **Authoritative as-built record + all
gotchas/deferred items:** the "Current deployment — AS BUILT" section in `docs/setup-runbook.md`. Still
open before real users: web-side Sentry build-arg, UptimeRobot, Neon paid tier, repo→private+Pro, Brevo
consent-email test, AWS root MFA (see the runbook's deferred list).
