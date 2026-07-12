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
| **API** | **Spring Boot on Java 21 (LTS)**, plain (no JHipster) · Undertow | Modular monolith. Java 21 virtual threads for I/O scalability. |
| **Security** | Spring Security, **session-based** (Spring Session JDBC → Postgres) | Hand-built flows (own the consent/guardian/RBAC logic); **no JWT machinery** — sessions are instantly revocable (ADR 9). |
| **Persistence** | Spring Data JPA + Hibernate · **Liquibase** (additive migrations) · MapStruct (DTOs) · Bean Validation | |
| **Database** | **PostgreSQL (managed)** | JSONB flexible attributes, FTS, pgvector for AI. Neon (free) → paid tier (~$20/mo) before real users. |
| **Cache** | **Redis** | Hot-query cache + per-IP rate-limit counters **only** — nothing durable lives in Redis (ADR 10). Jobs & sessions live in Postgres. |
| **Files** | **AWS S3 (private bucket)** | Access via **pre-signed URLs** (not proxied through the API). |
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
- **Files (S3):** private bucket; downloads via **pre-signed URLs** with short TTL (scales better than proxying, keeps access control — important for minors' submissions).
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
- **Theming:** light **and dark mode** via design tokens. Logo/icon assets (favicon, wordmark, light/dark variants) live in `packages/ui`; **use placeholder assets until the owner provides the finals**, then swap in place (no code change beyond the asset).
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
- [ ] Logo/icon/favicon, light + dark variants (in `packages/ui`)
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
