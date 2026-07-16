# BeeCompete — Architecture

**Status:** Living document · **Last updated:** 2026-07-06 · Depends on: `domain-model.md`, `feature-registry.md`

The technical foundation: stack, system shape, and the cross-cutting concerns (security, privacy,
observability) that a minors-facing, payments-handling, enterprise app requires. Built solo with AI
assistance, so the guiding bias is **offload operational burden to managed services; own the code that
is core to us.**

---

## 1. Principles

- **Modular monolith, not microservices.** One deployable backend, internally split into domain
  modules. Extract a service only when a real scaling/ownership reason appears.
- **Server is the source of truth; clients are read-only mirrors.**
- **Offload ops to managed services** (database, error tracking, email, CDN/WAF) — build features, not infrastructure.
- **Security & privacy are first-class**, because users are minors and money moves.
- **Boring, proven technology.** No exotic choices.
- **One design system** — all shared visuals live in `packages/ui`, consumed as source.
- **Secrets via environment only**, never committed.

## 2. System topology

```
                       ┌─────────── Cloudflare (DNS · CDN · WAF · DDoS) ───────────┐
   Browser  ───────────►  caches public pages · blocks bots/attacks · rate limits  │
                       └──────────────────────────┬───────────────────────────────┘
                                                  ▼
              IONOS VPS  ──  ONE shared edge Caddy (auto-HTTPS, owns 80/443)
                                     ├── Next.js container(s)  (web + BFF; public)
                                     └── Spring Boot container(s) (API; private/internal net)
                                                  │
        ┌──────────────────────┬──────────────────┼───────────────────┬─────────────────┐
        ▼                      ▼                   ▼                   ▼                 ▼
 Managed Postgres        Redis (cache +         AWS S3            Stripe            Brevo (email)
 (Neon → paid;           rate-limit only)    (private files,    (payments)      + Cloudflare Email
 backups + PITR)                              pre-signed URLs)                    Routing (inbound)
```

Replaceable (app containers) live on the VPS; **irreplaceable data (Postgres) is managed off-box.**

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| **Web** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 | SSR/SSG for SEO; long-running container (`next start`), not serverless. Also the **BFF** — forwards the httpOnly session cookie to the API. |
| **API** | **Spring Boot on Java 21 (LTS)**, plain (no JHipster) · Tomcat (default) | Modular monolith. Java 21 virtual threads for I/O scalability. *(Undertow → Tomcat 2026-07-12: Undertow deprecated in Boot 3.5/removed in Boot 4, and `spring.threads.virtual` only applies to Tomcat/Jetty.)* |
| **Security** | Spring Security, **session-based** (Spring Session JDBC → Postgres) | Hand-built flows (own the consent/guardian/RBAC logic); **no JWT machinery** — sessions are instantly revocable (ADR 9). |
| **Persistence** | Spring Data JPA + Hibernate · **Liquibase** (additive migrations) · MapStruct (DTOs) · Bean Validation | |
| **Database** | **PostgreSQL (managed)** | JSONB flexible attributes, FTS, pgvector for AI. Neon (free) → paid tier (~$20/mo) before real users. |
| **Cache** | **Redis** | Hot-query cache + per-IP rate-limit counters **only** — nothing durable lives in Redis (ADR 10). Jobs & sessions live in Postgres. |
| **Files** | **AWS S3** | Two asset classes on **separate buckets**: **public display assets** (cover images) on a public-read bucket; **private user files** (minors' submissions, R2) on a private bucket via short-TTL **pre-signed GETs**. Both upload via pre-signed **PUT** — never proxied through the API. |
| **Payments** | **Stripe** (+ Connect later for host fee collection / creator payouts) | |
| **Email** | **Brevo SMTP** (transactional/no-reply) + **Cloudflare Email Routing** (inbound support@ → Gmail) | SPF/DKIM/DMARC configured. |
| **AI** | Provider-agnostic proxy in the API; key server-side only | **Never send minors' PII to a free tier** (no DPA/no-training). |
| **Build** | Gradle (API) · Turbo/pnpm (web monorepo) | |
| **Observability** | **Sentry** (errors) + Spring **Actuator** metrics + uptime monitor + structured logs | |
| **CDN/edge/DNS** | **Cloudflare** (DNS + CDN + WAF + DDoS) | Single provider; not GoDaddy. |
| **Hosting** | Self-managed **VPS (IONOS)** + Docker Compose + a **single shared edge Caddy** (auto-HTTPS, one per box, fronts staging + prod by hostname) | App only; DB is managed off-box (Neon). |

## 4. Application architecture (modular monolith)

The Spring API is one deployable, internally split into modules mapping to the domain clusters. Each
module owns its entities, services, and API; cross-module calls go through service interfaces.

`accounts` (users, guardianship, orgs, membership, RBAC, consent) · `catalog` (competition, edition,
category, region, resource) · `discovery` (search, recommendations) · `journey` (participant↔competition
lifecycle + event log) · `entitlements` (products, orders, Stripe) · `trust` (verification, provenance,
moderation) · `notifications` (email, reminders) · `admin` (curation tooling) · `platform` (files, jobs,
flags, config). **Reserved modules:** `prep` (Participant+), `host` (registration/submission/judging).

**API style:** REST/JSON, versioned (`/api/v1`). The browser talks only to Next.js; Next.js (BFF) calls
Spring and forwards the httpOnly session cookie — the session ID never touches client JS.

## 5. Auth, identity & access

- **Sessions, not JWT (ADR 9, 2026-07-07 — replaces the earlier JWT + refresh-rotation design):**
  server-side sessions via **Spring Session JDBC (Postgres)**; the session ID lives in an **httpOnly,
  Secure, SameSite cookie** and is **rotated on login** (fixation protection). Benefits: **instant
  revocation** (a compromised minor's session dies immediately — no token-expiry lag), far less
  custom token code (no rotation/reuse-detection/revocation-list machinery), and sessions survive
  restarts (Postgres-backed, covered by backups). If a public third-party API (B4) ever ships, token
  auth is added *for API clients only* — user login stays session-based.
- **Login methods:** email/password (+ **password reset** + email verification) and **Google login (OAuth)**.
  ⚠️ *Google/social login interacts with age-gating — under-13 Google accounts are Family-Link managed;
  the consent flow must run regardless of login method.*
- **Route/page protection** ("access certain pages only when authenticated"): enforced on **both** sides —
  Next.js middleware guards routes for UX; Spring Security enforces authorization on every API call (the
  real gate). Never trust the client.
- **RBAC:** org-scoped roles (owner/staff/judge/coach/admin), per the domain model.
- **COPPA guardian/consent model** is custom and gets its own **Phase-1 auth deep-dive** — account
  inactive until parental consent; guardian-linked minor accounts; age-gating.

## 6. Data layer

- **Postgres + JSONB:** typed Spine columns + validated JSONB `attributes` (per-category JSON Schema).
- **Migrations:** Liquibase, additive-only, run safely on deploy.
- **Search:** Postgres FTS + `pg_trgm` at launch → dedicated engine (Typesense/Meilisearch) when faceted search outgrows it.
- **Cache (Redis):** hot queries (competition listings) + rate-limit counters **only** — nothing durable in Redis; sessions and jobs live in Postgres (ADR 9/10). Add a Redis read-through session cache only if session lookups ever become measurable DB load (sustained hundreds of authenticated req/s).
- **Neon/serverless connection handling** *(write it down — it burns a day in prod otherwise):*
  - **Endpoints:** app queries via Neon's **pooled `-pooler` endpoint** (PgBouncer, transaction mode); **Liquibase migrations + any advisory-lock / LISTEN-NOTIFY work via the *direct* endpoint.** The Postgres job queue must use `SELECT … FOR UPDATE SKIP LOCKED` (pooler-safe), **not** session advisory locks.
  - **HikariCP for autosuspend:** modest `maximum-pool-size`; `max-lifetime`/`idle-timeout` **shorter than Neon's idle window**; connection validation on; `connection-timeout` generous enough to absorb cold-start wake latency (or retry the first request).
  - **Kill cold starts on prod:** on the paid tier, **disable autosuspend** (always-on compute) — cold starts become a dev/staging-only concern.
  - **Region proximity:** put the **VPS and Neon in the same region** (as built: IONOS US East ↔ Neon `us-east-1`). Cross-region latency compounds badly for chatty ORM queries.
- **Files (S3):** two asset classes on **separate buckets**. **Public display assets** (cover images, R1-19) live on a **public-read** bucket (`covers/` prefix) — cards/detail/OG/ISR need stable, cacheable, indexable URLs, so pre-signed *GETs* don't fit; upload is a pre-signed **PUT** (`POST /admin/uploads/cover`), browser → S3 direct, public URL stored in `competition.logo`. **Private user files** (minors' submissions, R2) stay on a **private** bucket, downloaded via short-TTL **pre-signed GETs** (access control for minors). Neither is proxied through the API.
- **Backups:** managed Postgres automated backups + **PITR**, with a **tested restore** (a backup you haven't restored isn't a backup).

## 7. Async & background jobs

**Postgres-backed durable job queue** (JobRunr or db-scheduler; `FOR UPDATE SKIP LOCKED` pattern) for:
consent emails, deadline reminders, notifications/digests, search reindexing, AI generation,
data-ingestion/verification, stale-listing detection. Jobs are **enqueued in the same DB transaction**
as the change that caused them — no lost or ghost jobs — and they survive restarts and are covered by
backups/PITR. Spring `@Scheduled` for cron-like tasks. Redis is deliberately **not** the queue (ADR 10):
a crashed container must never silently drop a consent email. Polling pickup (~1–5 s) is fine for our
job types; revisit only at thousands of jobs/second.

## 8. Frontend architecture

- **Rendering:** SSG/ISR for public marketplace pages (SEO — the acquisition channel); client/SSR for authed dashboards.
- **Responsiveness:** **mobile-first, fully responsive** — non-negotiable (many students are mobile-only). Tested at mobile/tablet/desktop breakpoints.
- **Design system (`packages/ui`):** the single home for **shared components** — buttons, dropdowns, inputs, icons, tokens — so everything is styled uniformly. **Rule: never inline SVGs or hand-roll styles**; if it's shared, it lives here. Consumed as source via `transpilePackages`.
- **Theming:** light **and dark mode** via design tokens. **Brand art (finals in, 2026-07-16):** the
  `Logo` (wordmark) + `LogoMark` (icon-only) **components** live in `packages/ui`; the raster PNG art
  they render is served from **`apps/web/public/brand/`** (`{logo,mark}-{light,dark}.png`). Both theme
  variants sit in the DOM and CSS swaps them via the class-based `.dark` selector — SSR-safe and
  flash-free (no `useTheme`). The favicon (`apps/web/src/app/icon.svg`) is a self-contained SVG that
  embeds both icon marks and swaps on `prefers-color-scheme`; the OG share cards embed the wordmark as
  a base64 data URI (`lib/og-wordmark.ts`) since `next/og` can't fetch app assets at render time. The
  owner-supplied art is **raster PNG** (not true vector) — adequate for every current surface; a large
  (≥512px) app/PWA icon would need a higher-res or vector source.
- **Client validation:** field checks mirror server rules for UX; **server-side Bean Validation is the real enforcement.**
- **SEO:** semantic markup, metadata/OpenGraph, sitemaps, per-competition/-category landing pages, clean URLs. Submit sitemap to **Google Search Console + Bing Webmaster Tools** at launch.

## 9. Security

- **Edge:** Cloudflare **WAF + DDoS protection + bot management** in front of everything.
- **Rate limiting:** **per-IP** at Cloudflare *and* app-level (Redis) on sensitive endpoints (login, signup, password reset, submissions) — anti-abuse and anti-scraping.
- **Input validation / field restrictions:** Bean Validation on every DTO server-side + client-side mirror; strict allow-lists, size/type limits on uploads.
- **Transport & headers:** HTTPS everywhere (Caddy/Let's Encrypt), HSTS, CSP, secure cookie flags.
- **Secrets:** environment variables only; never committed. Plan a secrets manager (Doppler/SSM) as it grows.
- **Supply chain:** dependency + secret scanning + SAST in CI.

## 10. Privacy, compliance & legal *(elevated — users are minors)*

- **COPPA** (under-13): verifiable parental consent before data collection; parent-as-payer.
- **FERPA:** if we touch school-managed student data (educator/institutional path).
- **GDPR/ePrivacy:** relevant if EU traffic — **cookie-consent banner** required for any non-essential/tracking cookies (essential auth cookies are exempt). Data export + deletion (right to erasure).
- **Analytics choice ⚠️:** **standard Google Analytics is a poor fit for a child-directed service** — Google's terms restrict GA on COPPA-covered sites, and it sets tracking cookies. Note the marketplace is child-directed **even for logged-out visitors**, so splitting GA by login state does *not* make it safe; only splitting by *section/audience* is defensible, and the highest-traffic area (the marketplace) is child-directed regardless.
  - **Recommendation:** use **privacy-first, cookieless analytics everywhere** — **Cloudflare Web Analytics** (free, already on Cloudflare) for traffic + **PostHog** (free tier; doubles as our feature-flag + product-telemetry X20 system). Both are cookieless → **no consent banner needed** for them. Alternatives: Umami (free self-host), Plausible/Fathom (~$9–15/mo).
  - **GA only later, and only on adult-directed pages** (marketing site, pricing, host/educator dashboards) *if* paid ad-campaign attribution becomes worth it. Never on child-directed areas. *(This replaces the "Google Analytics" checklist item with a compliant equivalent.)*
- **Legal pages:** Privacy Policy (COPPA-compliant), Terms & Conditions, Cookie Policy, **affiliate disclosure** (FTC, ships with affiliate links), community/content guidelines. Required before public launch.
- **Data governance:** audit logging on sensitive/admin actions; retention + deletion policy; encryption at rest (managed DB) and in transit.

## 11. Observability

Sentry (errors, both web + API) · Spring Actuator health/metrics · uptime monitoring (e.g., UptimeRobot/BetterStack) · structured JSON logs aggregated centrally. **In-app bug/feedback report** (ties to trust/safety reporting DQ7) routed to the issue tracker + Sentry context.

## 12. Email & notifications

- **Transactional (`no-reply@`):** Brevo SMTP — verification, password reset, consent, receipts, reminders. SPF/DKIM/DMARC set for deliverability (critical: COPPA consent depends on parents receiving mail).
- **Inbound (`support@`):** Cloudflare Email Routing → forwarded to Gmail.
- **Marketing/subscription list:** Brevo lists for the newsletter/digests (M26) with opt-in + unsubscribe; **parental context respected for minors.**

## 13. Admin portal

Internal-only, behind strict RBAC + audit logging. Powers curation, **host verification** (DQ11–14),
moderation queue (DQ8), data-quality/dedup tools, and support/override actions. **Legalities considered:**
least-privilege access to minors' PII, every admin action audited, no bulk PII export without justification.
**Bootstrapping:** at R1 — before the app's auth system exists — the admin route is protected by
**Cloudflare Access** (email allow-list); it migrates to real RBAC at R2 (tasks R2-7 / R2-17b). Build-out
is staged: R1-3/R1-3b (curation CRUD + import/corrections queues) → R2-17/R2-17b (moderation + support
tooling + audit log) → Phase 2+ (dedup DQ4, conflict resolution DQ5) → Phase 3 (host verification DQ11–14).

### 13a. Admin — as built (R1-3, 2026-07-12)

- **API:** a `catalog.curation` package exposes `/api/v1/admin/**` (REST/JSON) — CRUD for
  Competition/Edition/KeyDate/Resource/Category(+CategoryTemplate)/Organization, an **import-review
  queue** on a new `import_record` table (Liquibase `0006`: `payload` JSONB + source/confidence/
  status; approve → creates the real Competition with `provenance.source=import`), landing content
  (HeroCard upsert-by-position + FeaturedSlot carousel, ≤10, archived-competition guard), and
  verification/provenance controls. Every attributes write validates through
  `CategoryAttributeValidator`; every write stamps provenance.
- **Complete-by-default create (sweep, 2026-07-15/16):** `POST /api/v1/admin/competitions/with-edition`
  creates a Competition + its first Edition + the edition's **typed key dates** (a
  `List<FirstEditionKeyDate>` — reg opens/closes, submission due, results; each dated or TBD) + its
  **regions**, in **one transaction** (`ListingCurationService`, composing the per-record curation
  write paths, so all invariants — attributes template, provenance — still apply). A partial create
  can't leave the "zombie" listing the **readiness gate** (§13b) hides. An **admin-form completeness
  policy** lives on `CompetitionWithEditionRequest` (`@AssertTrue`s: organizer, summary, description,
  official + registration URL, prize, ≥ 1 region, and ≥ 1 `REG_CLOSE`/`SUBMISSION_DUE` key date
  dated-or-TBD; plus a **cost-aware fee** rule — PAID ⇒ fee > 0 + currency, FREE ⇒ no fee) so a
  manual listing is complete by default — kept HERE, not on the shared `CompetitionRequest`/
  `EditionRequest`, so imports + corrections stay lenient. Plain `POST /competitions` stays for edge
  cases; future editions use `POST /competitions/{id}/editions`.
- **Create-competition form (sweep stepper build, 2026-07-15/16):** a **vertical stepper**
  (`packages/ui` `Stepper`) over five steps — Basics / About / Format & eligibility / Media & links /
  First edition — with a form-wide required-fields **completion ring** (`packages/ui` `ProgressRing`)
  that gates the Create button (server re-validates regardless). Field UX worth keeping: **auto-slug**
  (`slugify(name)` until the slug is hand-edited; create-only — slugs are permanent), grade/age as
  **dropdowns** sharing the marketplace grade ladder (`GRADE_VALUES`, an "Any" default, age to "99+")
  with min ≤ max validation, an **Organizer "+ Add organization…"** option, a repeatable **typed
  key-date** row editor (indexed `keydate_N_*` fields; wall-clock via `zonedWallClockToInstant`), and
  **`region-picker.tsx`** — a grouped/searchable region tree used by BOTH the create form and the
  edition `RegionTagger`, with soft scope assist (NATIONAL → suggest US, VIRTUAL → suggest
  Virtual/Online). Regions are pre-seeded (Liquibase `0010`: US + 50 states + DC + ~25 cities +
  Virtual/Online) so admins pick, not hand-create. Edit mode renders the same `stepDefs` as stacked
  `FormSection`s (no stepper).
- **Cover-image upload (R1-19, 2026-07-16):** `POST /api/v1/admin/uploads/cover` returns a short-TTL
  **pre-signed S3 PUT URL** (validates PNG/JPEG/WebP + ≤ 5 MB) so the browser uploads the cover
  **directly to S3** — never proxied through the API. The returned public URL is stored in
  `competition.logo` and renders on the card + detail header (else generated category art). Covers are
  **public display assets** (see the Files note, §2). Env-gated (`S3Config`'s `S3Presigner` bean is
  created only when `aws.s3.bucket` is set; endpoint 503s otherwise), so the paste-a-URL fallback
  always works. Credentials come from the AWS SDK's default env chain — never in config.
- **Admin auth (R1 stopgap, → RBAC at R2-7):** `AdminTokenFilter` requires a shared-secret
  `X-Admin-Token` header on every `/api/v1/admin/**` call. Fail-closed (blank `ADMIN_API_TOKEN`
  rejects all); constant-time compare; **scoped by a servlet URL-pattern** (matched on the decoded/
  normalized path) via `AdminSecurityConfig` — a raw-URI prefix test was bypassable with
  percent-encoding (`/api/v1/%61dmin/…`). The browser route is additionally behind **Cloudflare
  Access**. The API is unreachable off-box regardless (BFF pattern).
- **Web:** the `/admin` UI is **Next App Router server components + server actions**. The token
  lives server-side only — `apps/web/src/lib/admin-api.ts` is `import 'server-only'`; the browser
  calls Next, Next calls the API with the header. Public pages sit in an `app/(public)` route group
  so `/admin` has its own shell (`app/admin/layout.tsx`, noindex).
- **Admin form conventions (sweep round-4, 2026-07-13):** all admin dropdowns use the design-system
  **`Select`** — the old `NativeSelect` wrapper was deleted. Uncontrolled FormData forms pass
  `name` + `defaultValue` (`Select` posts via a hidden native-`<select>` mirror that also carries
  `required` constraint validation); controlled sites use `value`/`onValueChange`. **Optional
  selects must prepend an explicit `{ value: '', label: '— none —' }` option** so the field stays
  clearable — the mirror's placeholder isn't itself a selectable option. `enumLabel`/`enumOptions`
  live in `components/admin/enum-labels.ts`. Multi-section forms use the shared **`FormSection`**
  (`components/admin/form-section.tsx`) plus a **sticky save bar** (`sticky bottom-0`, holds Save +
  the server-error Alert); sectioned forms cap at `max-w-3xl`, simple ones at `max-w-xl`.
  `FormField`'s root is `grid content-start …` so hint-less fields don't drift ~11px low in
  multi-column grids. **Admin list tables** (`AdminTable`, `components/admin/admin-table.tsx`) stay
  **display-only server components** — row navigation is the **name-cell link only**. Whole-row-click
  was evaluated and **intentionally not built** (2026-07-16): a stretched-link over `<tr>` is
  unreliable (`position: relative` is inconsistent on table rows) and converting the table to a client
  component isn't worth the client JS for one nicety. Revisit only if `AdminTable` goes client for
  another reason.
- **Error contract:** `ApiExceptionHandler` (`@RestControllerAdvice`) maps
  `ResponseStatusException` (echoing its explicit, safe reason), Bean-Validation field errors (400),
  and `DataIntegrityViolationException`/`OptimisticLockingFailureException` (409) to a JSON body with
  a `message`. Needed because Spring Boot's default `server.error.include-message=never` hid reasons,
  leaving the admin UI showing a bare "admin API 422".
- **Hero cards (M36, rebuilt 2026-07-16):** the `/admin/landing` hero editor is **one form, one save**
  (`HeroCardsForm` + `saveHeroCards`, which upserts each position through `PUT /hero-cards/{position}`)
  — replaced three separate per-position forms/buttons in a misaligned grid. Layout mirrors the landing
  hero: a full-width **Main** panel (image + link + hover description) over two identical **satellite**
  panels (so they align); satellites are optional (a position with no image is skipped), and a card
  with an image requires alt text (client + server `@NotBlank`). Images use the shared `ImageUpload`
  (drag/browse → S3) via `uploadCoverImage` — hero images ride the **R1-19 cover endpoint** and its
  public `covers/` prefix (the only prefix the bucket policy exposes for read), with a paste-a-URL
  fallback; no new endpoint or bucket-policy change. (`ImageUpload` gained `onChange`/`setLabel` and a
  `min-w-0` fix so a long image URL can't blow out a grid column.)
- **Value-prop section (M36, 2026-07-16):** the Landing "Competing changes what's possible" block is
  admin-managed — two `ValuePropCard`s (image + link + label) and two `LandingStat`s (value + label +
  source), each a position-keyed upsert like `HeroCard` (`GET`/`PUT /value-prop-cards/{slot}` +
  `/landing-stats/{slot}`; slot = `PRIMARY|SECONDARY`). The `/admin/landing` editor is **one form, one
  save** (`ValuePropForm` + `saveValueProp`); card images are optional (S3 upload via the cover
  endpoint), and a null image renders the code-defined gradient+icon fallback so the approved look is
  unchanged by default. Public payload: `GET /api/v1/landing` gained `valuePropCards` + `stats`
  (additive). **Cache note:** the public landing fetch caches for an hour, so every landing-content
  save action (`saveValueProp`, `saveHeroCards`, `setFeaturedSlots`) now `revalidatePath('/')` (via
  `revalidateLanding()`) so edits show on the live page immediately, not up to an hour later.
- **Deferred (PR C):** inline row-edit for FAQ/Resource (add+delete today). **`@Version` is not sent**
  on admin PUTs yet, so concurrent edits last-write-win rather than 409 — acceptable for a single
  curator at R1; revisit with RBAC (R2-7).

### 13b. Corrections + public catalog read — as built (R1-3b/R1-4, 2026-07-12)

- **Corrections intake (R1-3b, DQ6/D7):** public `POST /api/v1/corrections` (outside the admin
  filter, no auth at R1) queues a `CorrectionProposal` (table shipped in R1-1 — no migration).
  Guards: a **per-subject-type field whitelist** (`CorrectionFields`, enforced at intake AND at
  approve so a stored payload can't smuggle writes; excludes slug/category/organizer ids, the
  `attributes` bag, and curator-only resource fields), subject-existence check, 8 KB payload cap,
  note ≤ 2000 chars, plus a honeypot in the web form. Real rate limiting = edge WAF at the R1-17
  gate. `submittedByUserId` stays null until accounts (R2-1).
- **Review queue:** `/api/v1/admin/corrections` list/get/approve/reject. **Approve applies the
  diff**: current record → request shape → merge whitelisted keys → Bean-validate → the SAME
  curation write path as an admin edit (`CorrectionApplyService`), so slug/category/attribute
  invariants hold and provenance is restamped `curated`. `EditionRequest`/`ResourceRequest` were
  promoted to `catalog.curation` with `Edition/ResourceCurationService` extracted (one write path
  per record type, same rationale as `CompetitionCurationService`). The get-by-id response carries
  the subject's **current whitelisted values** for the review UI's current-vs-proposed panel.
  **R1 audit record = the reviewed proposal row** (submitter note preserved; curator activity
  appended as `[curator]` lines); ActivityEvent diff-logging lands with R2-9.
- **Public catalog read (R1-4, M5/M6/DQ1):** `catalog.web` exposes `GET /api/v1/competitions`
  (paged, name-sorted browse feed) and `GET /api/v1/competitions/{slug}` (detail: editions +
  key dates + regions + resources + FAQs + organizer). Archived records are invisible (list and
  detail 404) per D7. **Readiness gate (sweep, 2026-07-15, domain-model §8a):** a public listing
  also needs a non-archived Edition — `archived_at IS NULL AND EXISTS(live edition)` gates the
  browse feed, search + grade/category facet counts (one shared `where()` predicate in
  `CompetitionSearchService`, plus `categoryOptions`/`itemsByIds`), detail (**404 when none**),
  sitemap (`findSitemapViews`), category tile counts, and the landing live-count
  (`countPublicListings`), killing "zombie" listings created with no edition. `verification_state`
  + provenance are exposed (DQ13 badges); enums render
  as **lowercase public tokens**; public DTOs omit version/audit columns and affiliate meta.
  **Effective status (binding rule, domain-model §8)** is computed by
  `catalog.service.EffectiveStatus` and returned as `effectiveStatus` beside the curated token —
  v0 rules: curated CLOSED/ONGOING/ARCHIVED stand; UPCOMING/OPEN with a passed deadline (earliest
  REG_CLOSE, fallback earliest SUBMISSION_DUE) → closed; UPCOMING inside the registration window →
  open. Search/filters/sort land at R1-5.

### 13c. Search & filter — as built (R1-5, 2026-07-12)

- **Infra (migration `0007`):** `CREATE EXTENSION pg_trgm` (fine on Neon as DB owner and on the
  postgres:16 test image); a **stored generated `tsvector` column** on `competition` (weighted:
  name A, tags/summary B, description C — expression wrapped in an IMMUTABLE SQL function because
  `array_to_string(text[])` is only marked STABLE); GIN indexes on the vector, on
  `lower(name) gin_trgm_ops` (typo tolerance), and on `evaluation_type` (the multi-valued facet
  the domain model reserved for R1-5).
- **One endpoint:** `GET /api/v1/competitions` (the R1-4 browse feed) grew the R1-5 params —
  `q`, `category` (slug), `minGrade`/`maxGrade`, `region` (id or code), `cost`, `delivery`,
  `participation`, `pathway`, `evaluation` (repeatable), `deadlineWithinDays`, `sort`
  (`relevance|name|newest|deadline`), `facets`. Implemented in
  `catalog.service.CompetitionSearchService` — native SQL (FTS/trigram/lateral have no JPQL
  form) returning ids + computed next deadline, entities hydrated via the repository.
- **Semantics (as-built decisions):** keyword match = FTS (`websearch_to_tsquery`) OR
  `word_similarity ≥ 0.3` on the name (word-span, not whole-string — short queries aren't
  diluted by long names); **grade = range overlap** (null bound = open side);
  **participation/pathway are eligibility filters** (filtering `individual` includes
  BOTH/EITHER records — the parent's question is "can we enter this way?"); **next deadline** =
  earliest FUTURE `REG_CLOSE` over live editions, **falling back to `SUBMISSION_DUE`**
  (consistent with `EffectiveStatus`; fallback added post-review 2026-07-12 — submission-driven
  competitions often have no registration step and otherwise vanished from the deadline
  filter/sort; the web detail page mirrors this rule exactly in `lib/detail-display`), deadline
  sort puts no-deadline records last; **facet counts** (Grade + Category only, per the Page-2
  blueprint) exclude the facet's own filter; **unknown token → 400** naming the allowed set,
  **unknown value (slug/region nobody has) → empty page**, not an error.
- **Evaluation types are now canonical tokens** (`EvaluationTypes`: `submission, exam,
  live_performance, interview, portfolio` — stored lowercase, i.e. the public token form) and
  validated at the curation write boundary (422) — closing the R1-1 note on
  `competition.evaluation_type`. The "format" facet (M3) filters on this array.
- **Deferred:** popularity sort (M4) waits for its signal (M31 save counts, R2-10);
  region/category **hierarchy descent** in filters (a US filter doesn't yet match state-tagged
  editions; categories are flat at R1); per-facet counts beyond Grade/Category (blueprint says
  those two only).

## 14. Environments & deployment

> **As built (LIVE 2026-07-12):** IONOS VPS, US East. A **single shared edge Caddy**
> (`infra/docker-compose.edge.yml`, project `beecompete-edge`, on the external `web_edge` network)
> owns 80/443 and fronts **both** staging and prod **by hostname** — the per-stack Compose files run
> **web + api only** (no Caddy each). This is what lets both environments (and any future app) share one
> box without a port clash. Full detail: the "Current deployment — AS BUILT" section in `setup-runbook.md`.

- **Local dev:** Docker Desktop (developer machines only — *not* the deployment target).
- **Staging:** a **second Docker Compose stack on the *same* VPS** (separate containers/network, `staging.` subdomain, **separate staging DB** + S3 prefix, kept private via Cloudflare Access + `noindex`). The shared edge Caddy auto-issues its cert. ~$0 extra; graduate to its own host only if staging load risks prod. See `setup-runbook.md` §4b.
- **Production:** the prod Compose stack on the VPS — Spring + Next behind the shared edge Caddy, Cloudflare in front, **managed Postgres off-box** (never in Compose). Separate DB, S3 prefix, and secrets from staging.
- **CI/CD triggers — how `main` ≠ prod (GitHub Actions):** `ci.yml` on every PR/push (tests + dependency/secret/SAST scans, **no deploy**). **`deploy-staging.yml` on push to `main`** → build `:sha` image → deploy to **staging** + migrate staging DB. **`deploy-prod.yml` on a pushed release tag (`R*`) or manual dispatch** → **promote the same tested image** to **prod** + migrate prod DB (optional manual-approval gate via the `production` Environment). A plain merge to `main` fires **only staging**; prod updates **only** on a deliberate release tag. Both gated by health checks + rollback; Liquibase migrations run as a gated step. See `setup-runbook.md` §8.
- **Migration path (reliability):** because the app is containerized and data is managed off-box, moving to a managed container host (Fly.io/Render) or adding redundancy later is a low-drama step. Documented, not built yet.
- **Bootstrap-without-a-domain:** sslip.io for real certs on a bare IP during early setup.

## 15. AI features

Provider-agnostic proxy in the API (swap providers freely); key in server env only. Current: Google
Gemini for non-sensitive use. **Hard rule: no minors' PII through a free/no-DPA tier** — use a paid tier
with a no-training guarantee and minimize/anonymize data when AI touches real user data.
**First production use:** the catalog-seeding extraction pipeline (`phase-1-plan.md` §"Data seeding") —
public web data only, no user PII, output schema-validated + human-reviewed before publish.

## 16. Repository structure (monorepo)

```
/apps/web        Next.js app
/apps/api        Spring Boot app (Gradle)
/packages/ui     shared design system (components, tokens, icons) — consumed as source
/packages/config shared config/types
/infra           Docker Compose, Caddyfile, deploy scripts
/.github/workflows  ci.yml, deploy.yml
/docs            these planning docs
```

## 17. Launch & ops readiness checklist

Operational tasks (from the product checklist) to complete before public launch — tracked here so none are lost:
- [ ] Legal foundation: entity formed + insurance + trademark search (setup-runbook §1b)
- [ ] Domain purchased + DNS on Cloudflare
- [ ] Emails: `no-reply@` (Brevo) + `support@` (Cloudflare Routing → Gmail); SPF/DKIM/DMARC
- [ ] Legal pages live: Privacy, T&C, Cookie Policy, affiliate disclosure
- [ ] Cookie-consent banner — **not needed at launch**: analytics are cookieless by decision (§10) and essential auth cookies are exempt. Revisit *only* if a tracking/marketing tool is ever added.
- [ ] Privacy-first analytics installed (not standard GA)
- [x] Logo/icon/favicon, light + dark variants — **finals in (2026-07-16)**: components in `packages/ui`, art in `apps/web/public/brand/`, adaptive `icon.svg` favicon (see §8)
- [ ] **Beta tag + disclaimer** (product is beta; data may be incomplete; not official affiliation)
- [ ] Email subscription/newsletter list (Brevo, opt-in)
- [ ] Password reset + email verification flows
- [ ] In-app bug/feedback report
- [ ] Sitemaps submitted to Google Search Console + Bing Webmaster Tools
- [ ] Rate limiting + WAF verified; secrets in env; backups restore-tested

## 18. Initial ADRs (decision log)

Future decisions append to `docs/adr/`. Locked so far:
1. **Modular monolith** (not microservices) — small team, clear boundaries, extract later if needed.
2. **PostgreSQL** — chosen for our JSONB flexible-schema + FTS + pgvector needs (not competitor norm, which skews MySQL/SQL Server; our Java/Spring stack has no DB default, so chosen on merit).
3. **Managed database, never on the VPS** — reliability + minors' data safety.
4. **Self-owned auth** (Spring Security, not a closed provider) — to control the COPPA consent/guardian/RBAC model.
5. **Plain Spring Boot, no JHipster** — avoid generated-code overhead; build deliberately.
6. **Privacy-first analytics over Google Analytics** — COPPA/child-directed compliance.
7. **Cloudflare as the single edge** (DNS+CDN+WAF+DDoS) — reliability/security/scalability, cheap.
8. **Two-language stack: Next.js/TS web + Spring/Java API** (2026-07-07) — kept deliberately. Rationale: builder's existing Spring background; JVM maturity, typing, and scalability for the long-lived API. Accepted cost: two ecosystems (Gradle + pnpm), duplicated validation (Bean Validation + client mirror), DTO/BFF plumbing. Alternative considered: TypeScript end-to-end (less work solo, but forfeits the Spring expertise advantage).
9. **Session-based auth, not JWT** (2026-07-07) — server-side sessions (Spring Session JDBC on Postgres) instead of access-JWT + refresh rotation + reuse detection + revocation list. Same UX; **instant revocation** (a minors' platform requirement); removes the highest-risk custom token code. Token auth can be added later for third-party API clients only (B4) without touching user login. Auth remains **self-owned** (ADR 4) — no external identity provider.
10. **Postgres for everything durable; Redis for cache only** (2026-07-07) — the job queue (JobRunr/db-scheduler) and sessions live in Postgres: transactional enqueue, survives restarts, covered by backups. Redis holds only hot-query cache + rate-limit counters, where loss is harmless.

## 19. Deferred to per-phase deep-dives
- **Auth deep-dive (Phase 1):** the full COPPA consent + guardian + RBAC design.
- **Payments/entitlements deep-dive (Phase 2):** Stripe integration, checkout, bulk allocation.
- **Host, compliance & judging infra (Phase 3–4):** registration, submissions, judging suite, compliance workflows — 🛑 **deliberately not designed ahead**; designed at the Phase-3 design gates (Gate A/B, `development-process.md` §6a).
- **Search-engine migration** when Postgres FTS is outgrown.
