# BeeCompete — Phase 1 Build Plan

**Status:** In build · **Last updated:** 2026-07-18 · Depends on: `domain-model.md`, `architecture.md`, `rfc-p1-auth-consent.md`, `development-process.md`

> **Build status (2026-07-18):** Foundation **F1–F8 done**. **R1 build (R1-1 → R1-16) is code-complete
> and LIVE in production** — catalog schema + Liquibase `0002`–`0013`, admin curation + import/correction
> queues, public catalog + search/filter API, the full public frontend (marketplace, category hubs,
> competition detail, Landing / How It Works / Categories), SEO + env-gated indexing, trust badges,
> share, the four (draft) legal pages, privacy-first analytics, Brevo captures (digest / follow / host +
> feedback), and a WCAG 2.1 AA a11y pass. **As-built detail lives in `architecture.md` §10a/§13a–§13c
> and `domain-model.md` §3b/§3f/§8/§8a — not re-logged here.**
> **S2/S3 seeding done:** the 284-competition master index (`docs/seeding/`) + the S3 extraction pipeline
> (`tools/seeding/`); S4 curation (the ≥ 200-live content gate) is the remaining seeding work.
> **Deployed:** IONOS VPS behind a shared edge Caddy, build-once-promote (staging on a `main` push, prod
> on an `R*` tag; currently **R1.2**) — see `setup-runbook.md` "Current deployment — AS BUILT".
> **R1-17 activation DONE (2026-07-18):** privacy-first analytics, Brevo captures, admin lockdown
> (Cloudflare Access + `ADMIN_API_TOKEN`), Cloudflare WAF + rate-limiting, UptimeRobot, and Sentry
> (web + API) are all live; Neon logical backups scripted (`scripts/backup-neon.sh`; paid-tier PITR
> deferred to R2). **Remaining R1-17 gate:** (1) privacy-counsel review of the legal pages + fill the
> operating entity / governing-law state + flip `LEGAL_REVIEW_PENDING`; (2) the content gate (S4
> seeding, ≥ 200 live); (3) flip `SEARCH_INDEXING=on` + submit the sitemap. Deferred: PR C (hero-image
> upload + inline FAQ/Resource edit) and the `sweep-remediation-plan.md` backlog.

The ordered, buildable task list for Phase 1. **Every task below becomes a GitHub Issue** (titled with its
task ID + registry refs) before coding — that's the required per-phase step. Build in the listed order;
each task is a vertical slice (DB → API → UI) done via the per-feature loop.

**Phase 1 ships as two public releases:**
- **R1 — Browse-only marketplace** (no accounts → light compliance, fast, SEO-driving).
- **R2 — Accounts + tracker** (adds COPPA consent; the core beta).

Legend: registry IDs in (parens). 🔒 = has a compliance gate.

---

## Milestone F — Foundation *(before any feature; do the setup-runbook in parallel)*

- **F1** — Monorepo skeleton (`apps/web`, `apps/api`, `packages/ui`, `infra`, `.github`) **+ root `CLAUDE.md`** encoding repo conventions (all shared UI from `packages/ui` — search there before creating anything; never inline SVGs; module layout; DTO/validation patterns to match). Every AI session loads it automatically — the main guardrail for light-loop tasks (dev-process §3).
- **F2** — Spring Boot skeleton: Java 21, Gradle, modular packages (`accounts`, `catalog`, `discovery`, `journey`, `platform`), Actuator, Bean Validation. (X-platform)
- **F3** — Next.js skeleton: App Router, TS, Tailwind v4, `packages/ui` wired via `transpilePackages`; app shell + **light/dark theming** + **placeholder logo/icon**. (M-frontend)
- **F4** — Postgres + Liquibase baseline; local `docker-compose` (postgres + redis). (X-data)
- **F5** — CI (`ci.yml`): web + API tests, lint, dependency/secret/SAST scans, path filters, caching. (dev-process §5)
- **F6** — Deploy pipeline (`deploy.yml`) → staging on merge; Caddy config; health checks. (setup-runbook §8)
- **F7** — `packages/ui` baseline: design tokens + core primitives (button, input, dropdown, card, badge, icon set). **Input: the approved decisions in `docs/design-brief.md`** — fill the brief (§2–§4: direction, references, tokens) *before* F7, so this task encodes decisions instead of inventing style mid-code. (Shared components)
- **F8** — Observability wiring: Sentry (web+api), structured logs, uptime. (X20)

---

## Release R1 — Browse-only marketplace *(no accounts)*

**Data & catalog**
- **R1-1** — Core schema migration: `Category`, `CategoryTemplate`, `Region`, `Competition`, `Edition`, `EditionRegion`, `KeyDate`, `Resource`, `CorrectionProposal` + provenance/verification/`archived_at` fields — per the locked modeling decisions (domain-model §7: grade encoding, Division placement, Edition-level regions, soft-delete D7). Include storage for **curated per-competition FAQ entries** (details-page FAQ tab, page-blueprints §3a — exact shape decided at build per domain-model rules). **2026-07-08 additions (domain model, legacy review):** `entry_pathway` on Competition; `age_cutoff_date` + `prize_summary`/`prize_value`/`prize_currency` on Edition; reserved `member_id` on User. **2026-07-08 additions (registry Rev 9):** `HeroCard` + `FeaturedSlot` (admin-managed Landing content, M36 — domain-model §3e-bis). *Article entities are NOT in R1-1 — Phase 2, additive (Hook #15).* (X9, catalog)
- **R1-2** — Category taxonomy + templates seeded (~10 K-12 categories) with JSON-Schema validation of `attributes`. (X9)
- **R1-3** — **Admin curation tooling v0** (X16, DQ13): minimal internal web admin — CRUD for `Competition`/`Edition`/`KeyDate`/`Resource`/`Category`(+templates), **import-review queue** (approve/edit/reject records from the S3 extraction pipeline — S4's 20–30 approvals/day throughput depends on this UI, so scripts alone don't cut it), and verification-state + provenance controls. **Landing-content panel (M36, Rev 9):** update the 3 `HeroCard`s (image upload, alt text; main card: link + hover description) and manage `FeaturedSlot` carousel picks (add/remove/reorder, 6–10 cap). Every admin write stamps provenance. **Access: behind Cloudflare Access (email allow-list) on the admin route — no app auth exists at R1; migrates to real RBAC at R2-7.**
- **R1-3b** — **Corrections intake + review** (DQ6): public "Suggest a correction" form on detail pages → `CorrectionProposal` rows (domain-model D7); admin review queue — approve applies the diff and writes an audit record, reject discards. DQ15 "request a competition" submissions (R1-15b) land in this same queue.

**Backend**
- **R1-4** — Catalog API: list/detail competitions + editions; `verification_state`/provenance exposed. (M5, M6, DQ1)
- **R1-5** — Search & filter API: Postgres FTS + `pg_trgm`; filters (category, grade, region, cost, format, individual/team, **entry pathway**, deadline), sort. (M2, M3, M4, X10)

**Frontend**
- **R1-6** — Marketplace: browse + search + filters + sort, per `page-blueprints.md` Page 2 (grade quick-chips, Grade-first facets, "Load more" + crawlable pagination, zero-results near-miss cards, hybrid category URLs with SEO text block). (M1–M4, M15)
- **R1-6b** — Public page set per `page-blueprints.md`: **Landing** (Page 1, incl. plain Browse-competitions button, hero category strip, **admin-managed hero image cards + featured-carousel slots** — blueprints #25–26, M36), **How It Works** (Page 4), **Categories index** (Page 5). Structure is the approved blueprint; style via the hero design pass (design-brief §5). (M15, H46, R1-13)
- **R1-7** — Competition detail page + edition/dates/status display, per `page-blueprints.md` Page 3 — incl. breadcrumb, "At a glance" strip (Grades · Deadline · Cost · Location · Prize · **Entry pathway**), **FAQ tab** (FAQPage structured data; content curated via R1-3), sticky sidebar, and **per-date add-to-calendar links (ics + Google)**. (M5, M6)
- **R1-8** — Resources section + affiliate links + **affiliate disclosure**. 🔒 (M11, DQ10)
- **R1-9** — Trust/verification badges (Curated/Verified). (DQ13)
- **R1-10** — SEO: SSG/ISR, metadata/OpenGraph, clean URLs, per-competition & per-category landing pages, **structured data** (schema.org `Event` markup on listings — rich results with dates), sitemap. (M15)
- **R1-11** — Share a competition. (M21)

**Launch surface**
- **R1-12** — Legal pages: Privacy, Terms, Cookie Policy, affiliate disclosure. 🔒 (compliance)
  ✅ **Pages built 2026-07-17** (`/privacy`, `/terms`, `/cookies`, `/affiliate-disclosure`), but
  they ship as **drafts** — three owner/counsel items below must clear before R1-17 flips the site
  public.
- **R1-13** — **Beta tag + disclaimer** across the app. (registry)
  ✅ **Done 2026-07-17** — header "Beta" badge gains a keyboard-reachable tooltip explainer; the
  footer carries the app-wide disclaimer (beta · details can change → confirm on the organizer's
  official site · independent, **not affiliated with or endorsed by** the listed organizers,
  compliance §8). Owner chose badge + footer over a page-top banner. Frontend-only, reuses existing
  `packages/ui` primitives (Badge, Tooltip).
- **R1-14** — Privacy-first analytics (Cloudflare Web Analytics + PostHog). (X20)
  ✅ **Code done 2026-07-17** — cookieless, public-pages-only, DNT/GPC-honoring, anonymous PostHog
  (memory persistence, no person profiles, autocapture/replay off, manual SPA pageviews) + CF Web
  Analytics beacon; runtime-env/inert-without-tokens (build-once-promote safe); `trackEvent()`
  exposed for X20 zero-result search. **Owner setup to switch on:** set `POSTHOG_KEY` +
  `CF_WEB_ANALYTICS_TOKEN` (+ optional `POSTHOG_HOST`) in the prod `.env` — exact steps in
  setup-runbook §11. As-built: architecture §10a.
- **R1-15** — **Weekly Digest signup** (Brevo): email capture + 2–3 preference questions (grade, category/interests, region) per `page-blueprints.md` Landing §5. ⚠ Scope note: R1 ships the *capture + segmentation*; early digest sends are manual/curated via Brevo — the **automated personalized matching send is M26 (Phase 2)**. (M26 precursor)
  ✅ **Code done 2026-07-17** — the DigestBand (Landing/How It Works/Categories) now does real Brevo
  capture: email + optional Grade/Interest/State selects → Brevo contact + list (attributes
  GRADE/INTEREST/STATE), **double opt-in** when a template is configured. Pitched to
  parents/educators/16+ with consent microcopy + Privacy link (COPPA-safe — a newsletter to a child
  would trigger consent); honeypot; **inert without Brevo env** (friendly "opening soon"). Single
  interest for R1 (multi is a later enhancement). Owner setup: setup-runbook §7a.
- **R1-15b** — Listing-page captures (Brevo/queue-backed, no accounts needed): **per-competition follow-by-email** (M29), **"Request a Competition"** multi-step wizard form (page-blueprints Page 6) → curation queue (DQ15), **"Are you the organizer?" host-interest CTA** → host waitlist (H46).
  ✅ **Code done 2026-07-17.** Owner decisions (2026-07-17): follow + host captures use **Brevo lists**
  (no schema), and follow ships now with **parent/16+ framing + double opt-in** (COPPA-safe). Built:
  (1) **Follow** + (2) **host-interest** replace the R1-7 detail-page stubs with real `EmailCaptureCta`
  → Brevo follow/host lists (competition stored as the `COMPETITION` attribute), inert without env;
  (3) the **Request-a-Competition wizard** (`/suggest-a-competition`, 5-step, progress, `?q=` prefill)
  → a **public** `POST /api/v1/competition-requests` (outside the admin filter) that queues an
  `ImportRecord` into the R1-3 import/curation queue for curator review. No submitter PII on the
  request path (COPPA-clear). **Post-review fix:** migration `0013` adds `import_record.origin`
  (`PIPELINE`|`USER_REQUEST`) so public requests are badged in the admin queue + review header —
  curators never apply pipeline-grade trust to an unvetted submission. Owner setup: setup-runbook §7a.
- **R1-16** — In-app **bug/feedback report**. (DQ7 precursor)
  ✅ **Code done 2026-07-17.** A lightweight `/feedback` page (noindex) + footer "Send Feedback"
  link (Contribute column): category (Bug/Idea/Content/Other) + message + optional reply email +
  honeypot → **Brevo transactional email to support@** (`sendTransactionalEmail`, reuses
  `BREVO_API_KEY`; from = `BREVO_SENDER_EMAIL`, verified sender required). No accounts/DB at R1;
  inert without Brevo (asks the visitor to email support@ directly). **Sentry feedback widget
  deferred** — the web Sentry client isn't wired yet (the F8 `WEB_SENTRY_DSN` build-arg TODO); bug
  reports route through this same form (category "Bug") until then. Owner setup: setup-runbook §7a.
- **R1-17** — **R1 release gate** (dev-process §8). **Activation DONE (2026-07-18):** WCAG-AA a11y pass
  on public pages; Cloudflare **WAF + rate-limiting** on; **admin** behind Cloudflare Access +
  `ADMIN_API_TOKEN`; **analytics** (CF Web Analytics + PostHog) + **Brevo** captures live; **UptimeRobot**
  + **Sentry** (web + API) on; Neon **logical backups** scripted (`scripts/backup-neon.sh`; paid-tier PITR
  deferred to R2). Switch-on steps + gotchas: setup-runbook §7a (Brevo) / §11 (analytics) / §5 (admin) /
  §9 (Sentry + uptime). **Still open before the gate clears:**
  - **🛑 Legal (hard blocker) — the four legal pages are DRAFTS until:**
    1. **Privacy-counsel review** of all four, especially the COPPA posture in the Privacy Policy
       (compliance.md §Launch gate #6). Not final until a qualified privacy attorney signs off.
    2. **Fill `OPERATING_ENTITY` + `GOVERNING_LAW_STATE`** in `apps/web/src/lib/legal.ts` once the LLC is
       formed (the "legal foundation done" item — setup-runbook §1b).
    3. **Flip `LEGAL_REVIEW_PENDING` → `false`** after #1–#2 — drops the on-page "Draft — under review" banner.
  - **📚 Content gate** — ≥ 200 competitions live across the ~10 categories (S4 seeding; see "Data seeding
    & catalog readiness" below). As blocking as any code item.
  - **🔎 Flip indexing** — the site is `noindex` until: set `SEARCH_INDEXING=on` in `~/beecompete-prod/.env`
    + recreate web, verify `robots.txt` serves the allow ruleset + a page emits `index, follow`, confirm
    staging still serves `Disallow: /`, then submit `sitemap.xml` to Google + Bing.
  - Then **tag the release + deploy to prod** — the public launch.

**R1 UI/data follow-ups (surfaced 2026-07-13 during the admin/marketplace UI review)** were
**built the same day** — including the two schema items once tracked here as standalone tasks:
**deadline "TBD" support** (migration `0008`) and the **org trust ladder + derived competition
maintainer** (migration `0009`); as-built rules live in `domain-model.md` §3f/§8 and
`page-blueprints.md` decisions #32–36; rounds 2–3 (queue reachability, schema-driven
attributes form, marketplace visual pass) built the same day. The **remaining backlog**
(the round-4 admin-UI polish pass + the R2-batched payload items) is tracked in
**`docs/sweep-remediation-plan.md`**.

---

## Data seeding & catalog readiness *(the R1 content workstream — runs in parallel with R1 code)*

Code alone doesn't make R1 launchable — **the catalog does**. An empty marketplace can pass every
technical gate and still be worthless to a visitor. Seeding is tracked as a first-class workstream
with its own tasks and a hard launch gate. Curation is also **permanent labor, not a one-time
import** — budget a few hours/week post-launch, guided by analytics (X20 depth-on-demand).

**R1 content gate** (enforced in R1-17):
- **≥ 200 competitions live at launch**, spanning **all ~10 seed categories** (≥ 15 each for the major ones).
- **Every listing has a current or upcoming Edition with verified dates** — no stale shells at launch.
- The **top ~50 by expected search volume** get a full spine + curated resources (these carry the SEO thesis).

**Tasks:**
- **S1 — Seeding strategy spike** (timeboxed ~1 day): confirm sources, master-index columns, and the
  extraction-pipeline design; pick the keyword-research tool for demand ranking.
- **S2 — Master index**: compile a 300+ long-list from aggregator "best competitions for students" lists,
  state DoE / gifted-program lists, CTSO & national-org calendars, school club pages, prior-year fair
  sites. Rank by (a) search volume, (b) category coverage, (c) upcoming-deadline proximity.
- **S3 — AI-assisted extraction pipeline v0**: script fetches each competition's official pages → LLM
  extracts Spine fields into JSON **validated against the Category Template JSON Schema** → record lands
  in the curation queue (R1-3) with `provenance.source = import` + a confidence score.
- **S4 — Curation sprints**: human review/approve every imported record before publish. **Write our own
  descriptions** — facts (dates, fees, eligibility) aren't copyrightable, but prose is; never paste theirs.
  Target throughput once the pipeline works: ~20–30 approved listings/day.
- **S5 — Freshness loop**: weekly stale-date report + a re-verification pass keyed to each Edition's
  annual cycle (lightweight precursor to DQ2/DQ3).

---

## Release R2 — Accounts + tracker *(adds COPPA consent)*

**Auth & consent** *(implements `rfc-p1-auth-consent.md`)*
- **R2-1** — Auth schema: `User`, `ParticipantProfile`, `GuardianLink`, `ConsentRecord`, `AuthCredential`, `Session` (Spring Session JDBC tables), `AuthToken`, `Role`/`Permission`. (X1, X2, X5)
- **R2-2** — Email/password auth: signup, **email verification**, **password reset**; Argon2id hashing. (X4)
- **R2-3** — **Server-side sessions** (Spring Session JDBC → Postgres): httpOnly session cookie, rotate-on-login, session list/revoke, auto-revoke all on reset/suspension/consent-revocation. (X4)
- **R2-4** — **Google OAuth login** (with age-gate for new users). 🔒 (X4)
- **R2-5** — **Neutral age gate** + account **state machine** (`PENDING_EMAIL`/`PENDING_CONSENT`/`ACTIVE`/…). 🔒 (X3)
- **R2-6** — **Under-13 parental consent (email-plus)** — flows B & C, guardian links, grace-window purge job. 🔒 (X2, X3)
- **R2-7** — RBAC (student/parent/admin) + **API authorization + resource-ownership** enforcement. (X5)
- **R2-8** — **Parent dashboard** basics: multi-child management, **review/refuse/revoke/delete** child data. 🔒 (PA1, PA2, PA5)

**Tracker & journey**
- **R2-9** — `ParticipantCompetition` lifecycle + append-only `ActivityEvent` log. (X23, X13)
- **R2-10** — Save/follow + **"My Competitions" tracker** + social-proof counts on listings (thresholded). (M7, M8, M31)
- **R2-11** — **External registration status** tracking. (M23)
- **R2-12** — Notifications engine + **deadline reminders** (email + in-app). (X11, X12, M9)
- **R2-13** — Calendar view + **subscribable iCal feed** + one-time export. (M10)

**Discovery personalization**
- **R2-14** — Onboarding interest quiz + profile (grade/interests/region). (M13)
- **R2-15** — Personalized recommendations (basic) + related competitions — *contextual only, per compliance*. (M12, M25)
- **R2-16** — New-competition alerts matching interests + **edition-cycle re-engagement** ("your competition announced its next edition") for followed/tracked competitions — also converts M29 email-followers to accounts. (M14, M30)

**Launch surface**
- **R2-17** — Trust/safety **reporting** + moderation queue v0. (DQ7, DQ8)
- **R2-17b** — **Admin support & override tooling + admin audit log** (DQ9, architecture §13): user lookup; resend verification/consent emails; suspend account; revoke sessions; execute COPPA parental deletion requests received off-platform (parents may request by email, not just via dashboard); view `ConsentRecord`s (compliance evidence). Admin access migrates from Cloudflare Access to real RBAC (R2-7); **every admin action writes an audit event**. 🔒
- **R2-18** — **R2 release gate**: consent flow verified, all legal live, **counsel sign-off on COPPA**, a11y, security, backups → **tag R2, deploy to prod.** 🔒

---

## Sequencing notes
- **Foundation (F) first** — nothing builds without it.
- **R1 is fully shippable and public before any R2 work** — get real traffic + SEO early.
- Inside R1/R2, respect dependencies: schema (R1-1, R2-1) before the APIs/UI that use it; auth (R2-1..7) before parent dashboard/tracker.
- **Build one competition category end-to-end first** (vertical slice), then broaden to the rest.
- Each 🔒 task carries a compliance check in its Definition of Done.
- **Seeding (S1–S5) runs in parallel with R1 code** — start S2 (master index) as soon as R1-1's schema is settled; the content gate is as blocking as any code task.
- **Go-to-market work runs in parallel** (waitlist, keyword research feeding S2, science-fair wedge outreach, problem interviews) — see `go-to-market.md`.
- **🛑 Validation gate before R2** (`vision-prd.md` §7): problem interviews (8–12 per persona, run during R0/R1) **+ R1 traffic/engagement signals must support the discovery thesis before building R2's compliance-heavy account system.** If they don't, revisit scope first.

## Next step
On approval: create the **GitHub Project board + Milestones (F, R1, R2)** and open an **issue per task** above, then start with **F1**.
