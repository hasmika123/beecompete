# BeeCompete — Phase 1 Build Plan

**Status:** In build · **Last updated:** 2026-07-12 · Depends on: `domain-model.md`, `architecture.md`, `rfc-p1-auth-consent.md`, `development-process.md`

> **Build status (2026-07-12):** Foundation **F1–F8 done** (staging + prod LIVE on IONOS).
> **R1-1 done** (catalog schema, migrations `0002`–`0004` + Organization). **R1-2 done** (11 launch
> categories + templates seeded `0005` + `CategoryAttributeValidator`). **R1-3 done** (admin curation
> API + `/admin` web UI, import queue `0006`; admin auth = shared token + Cloudflare Access →
> RBAC R2-7; as-built in `architecture.md` §13a). **R1-3b done** (public suggest-a-correction form +
> `/api/v1/corrections` intake with field whitelist, `/admin/corrections` review queue, approve
> applies the diff through the curation write path; as-built §13b). **R1-4 done** (public catalog
> read API: paged list + detail-by-slug, editions with **effectiveStatus** per the domain-model §8
> rule, verification/provenance exposed, lowercase tokens; as-built §13b). **R1-5 done** (search &
> filter on the same endpoint: Postgres FTS + pg_trgm typo tolerance — migration `0007` — all M3
> facets incl. eligibility-semantic participation/pathway, deadline filter/sort, Grade+Category
> facet counts; popularity sort deferred to R2-10; as-built §13c). **R1-6 done** (marketplace per
> Page-2 blueprint: CompetitionCard + category art system in `packages/ui`, filter panel/chips/
> quick-chips/load-more/near-miss, category hubs `/competitions/<slug>` + SEO blocks, sticky nav
> + Beta tag + real footer; interim noindex detail at `/c/<slug>` — decision #30; styling
> delegated #29). **R1-6b done** (Landing per Page 1 with admin-managed hero cards + featured
> carousel + digest band stub, How It Works, Categories index; public `GET /api/v1/categories`,
> `/landing`, `/regions`). Landing gaps tracked: hero images (PR C), Brevo digest (R1-15),
> sourced stats TODO(owner) before R1-17. **R1-7 done (2026-07-12)** — competition detail page
> at `/c/<slug>` per Page-3 blueprint: breadcrumb, at-a-glance strip, Key Facts/About/FAQ tabs,
> sticky sidebar (Follow stub, key-dates timeline with ics+Google add-to-calendar, trust/
> attribution panel, Claim stub, Suggest-a-correction), related row, schema.org Event/
> BreadcrumbList/FAQPage JSON-LD, mobile sticky Follow+Register bar; interim noindex dropped
> (page inherits the site-wide gate until R1-10/R1-17). Follow/Claim capture backends = R1-15b;
> Resources row = R1-8. **S2/S3 seeding done + merged (2026-07-12):** S2 master index (**284**
> ranked competitions after the post-audit cleanup, all 11 categories ≥18) in `docs/seeding/`;
> S3 extraction-pipeline v0 in `tools/seeding/` (fetch→LLM-extract→schema-validate→POST to the
> R1-3 import queue). **Post-review fix pass (2026-07-12, PRs #70–73):** adversarial review of
> R1-7/R1-8/S2/S3, all findings fixed — timezone-aware dates, SSR tab content (SEO),
> status-gated Register CTA, valid all-day ICS, virtual-only Event JSON-LD, runtime SITE_URL,
> deadline rule = REG_CLOSE with SUBMISSION_DUE fallback (server + web, blueprint decision #31),
> S2 data cleanup (326→284), S3 hardening (provenance/confidence/fetch safety).
> **R1-8 done (2026-07-12) 🔒** — detail-page resources row (M11): reused `ScrollRow` of
> type-tinted resource cards (book/past_paper/guide/video/other), each an outbound link with
> `rel="nofollow noopener noreferrer"`, and **affiliate links carry `rel="sponsored nofollow"`
> + a per-card "Affiliate" chip + a clear, conspicuous inline disclosure rendered with the row
> whenever any affiliate link is present** (FTC/DQ10; dedicated disclosure page still R1-12).
> **R1-10 done (2026-07-12) — SEO** (built before R1-9 at owner request): API
> `GET /api/v1/sitemap`; web `robots.ts` + `sitemap.ts`, shared `lib/seo.pageMetadata`
> (canonical + OG + Twitter + env-gated robots) on all public pages, dynamic `next/og` OG images
> (per-competition + default, self-contained), `ItemList` on listings + `WebSite`/`Organization`
> on Landing, ISR on detail pages (`[slug]` on-demand). **Indexing gated by `SEARCH_INDEXING`
> (default OFF)** — robots `Disallow:/` + page `noindex` until R1-17 flips it in prod (legal +
> COPPA gate first; the machinery is all in place). Build-once-promote (no API at build time)
> precludes build-time SSG for no-param pages — those render at request with data-cached reads.
> **Next:** R1-9 trust/verification badges. Deferred: PR C (S3 hero-image upload + inline
> FAQ/Resource edit).

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
- **R1-3b** — **Corrections intake + review** (DQ6): public "Suggest a correction" form on detail pages → `CorrectionProposal` rows (domain-model D7); admin review queue — approve applies the diff and writes an audit record, reject discards. DQ15 "suggest a competition" submissions (R1-15b) land in this same queue.

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
- **R1-13** — **Beta tag + disclaimer** across the app. (registry)
- **R1-14** — Privacy-first analytics (Cloudflare Web Analytics + PostHog). (X20)
- **R1-15** — **Weekly Digest signup** (Brevo): email capture + 2–3 preference questions (grade, category/interests, region) per `page-blueprints.md` Landing §5. ⚠ Scope note: R1 ships the *capture + segmentation*; early digest sends are manual/curated via Brevo — the **automated personalized matching send is M26 (Phase 2)**. (M26 precursor)
- **R1-15b** — Listing-page captures (Brevo/queue-backed, no accounts needed): **per-competition follow-by-email** (M29), **"Suggest a competition"** multi-step wizard form (page-blueprints Page 6) → curation queue (DQ15), **"Are you the organizer?" host-interest CTA** → host waitlist (H46).
- **R1-16** — In-app **bug/feedback report**. (DQ7 precursor)
- **R1-17** — **R1 release gate** (dev-process §8): a11y (WCAG AA) on public pages, WAF/rate-limit on, backups tested, legal pages live, **legal foundation done** (entity + insurance + trademark search — setup-runbook §1b), **content gate met** (see "Data seeding & catalog readiness" below) → **tag R1, deploy to prod.**

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
