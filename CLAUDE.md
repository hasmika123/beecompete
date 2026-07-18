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
- Hero pages (Landing, Competitions, Details, How It Works, Categories index, Request a Competition)
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
Planning complete. **Foundation F1–F8 done.** **R1 (browse-only marketplace) is code-complete and
LIVE in production** — R1-1 through R1-16 all shipped: catalog schema + Liquibase `0002`–`0013`, admin
curation tooling + import/correction queues, public catalog + search/filter API, the full public
frontend (marketplace, category hubs, competition detail, Landing / How It Works / Categories), SEO
(sitemap / OG / structured data, indexing env-gated), trust badges, share, the four legal pages,
privacy-first analytics, Brevo email captures (digest / follow / host + feedback), and a WCAG 2.1 AA
a11y pass. **The detailed as-built lives in the proper docs — don't re-log task-by-task here:**
`architecture.md` §10a/§13a–§13c, `domain-model.md` §3b/§3f/§8/§8a, `setup-runbook.md`. Next is the
**R1-17 launch gate** (`phase-1-plan.md`).

**DEPLOYED — LIVE on an IONOS VPS** (US East, Ubuntu 24.04) behind a **single shared edge Caddy**:
`https://beecompete.com` (+ `www`→apex) and `https://staging.beecompete.com`. Infra =
`infra/docker-compose.{edge,staging,prod}.yml` + `infra/Caddyfile` (edge owns 80/443 on the `web_edge`
network; per-stack files run web+api only; Neon is off-box). Pipeline = **build-once-promote**: staging
on a `main` push, prod on an `R*` tag (currently **R1.2**). Authoritative as-built + every gotcha: the
"Current deployment — AS BUILT" section in `setup-runbook.md`.

**R1-17 launch activation DONE (2026-07-18):** analytics live (Cloudflare Web Analytics + PostHog,
cookieless / anonymous), Brevo captures live (digest verified end-to-end; double opt-in), **admin
locked** behind Cloudflare Access + `ADMIN_API_TOKEN`, Cloudflare **WAF + rate-limiting** on,
**UptimeRobot** monitoring `beecompete.com`, and **Sentry** live (web browser + SSR + API). Neon stays
on the **free tier** with a logical-backup safety net (`scripts/backup-neon.sh`); paid-tier PITR is
deferred to R2.

**Remaining before the site can go public (the rest of the R1-17 gate):**
1. **Legal** — a privacy attorney must review the four legal pages (still DRAFTS; `LEGAL_REVIEW_PENDING`
   drives the on-page "under review" notice). Once the operating entity is formed, fill
   `OPERATING_ENTITY` + `GOVERNING_LAW_STATE` in `apps/web/src/lib/legal.ts` and flip
   `LEGAL_REVIEW_PENDING` → `false`.
2. **Content gate** — seed ≥ 200 competitions across the ~10 categories (`docs/seeding/`; the S3
   extraction pipeline is in `tools/seeding/`).
3. **Flip indexing** — set `SEARCH_INDEXING=on` in `~/beecompete-prod/.env` + recreate web, verify
   `robots.txt` / a page's `index,follow`, and submit `sitemap.xml` to Google + Bing.

**Deferred backlog:** `docs/sweep-remediation-plan.md` (R2 + Phase-3 items) · PR C (hero-card image
upload + inline FAQ/Resource row-edit) · reserved/gated items per the Hard-stops rule above.
