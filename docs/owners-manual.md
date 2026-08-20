# BeeCompete — Owner's Manual

**Status:** Living document · **Last updated:** 2026-08-19 · **Type:** Operator reference

Everything you need to remember to **run, maintain, and grow BeeCompete**, in one place.
This is the *operator's* view — deep technical detail lives in the docs linked throughout
(`setup-runbook.md` is the deployment bible; where they disagree, it wins).

---

## 1. What BeeCompete is (30-second refresher)

A marketplace for **K-12 academic competitions** — students/parents browse, filter, and track
competitions across ~11 categories (math, science, robotics, debate, …). Users are **minors** and
(later) **money moves**, so COPPA/privacy/security are first-class.

- **Live now:** `https://beecompete.com` (+ `staging.beecompete.com`) — **R1 browse-only marketplace**
  (no accounts, no PII, no payments). Currently **noindex** — not yet public/searchable.
- **Release plan:** R1 (browse, live) → **R2** (accounts + parental consent + tracker) → Phase 2 (payments via Stripe, articles, digest automation).
- **Current milestone:** clear the **R1-17 launch gate** (see §10) → flip the site public.

---

## 2. Tech stack & architecture (Foundation)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Next.js** (TypeScript, App Router, Tailwind v4) | `apps/web` — also acts as BFF; the API is never public |
| Backend | **Spring Boot** (Java 21, Gradle) | `apps/api` — modular monolith (`accounts`, `catalog`, `discovery`, `journey`, `platform`) |
| Shared UI | `packages/ui` (`@beecompete/ui`) | **All** shared components come from here — never inline SVGs / hand-rolled styles |
| Database | **Postgres on Neon** (serverless, off-box) | **Launch plan** (usage-based, since 2026-08-20). Staging + prod = separate branches. Migrations = **Liquibase, additive-only** (`0002`–`0013` so far) |
| Cache | Redis — **not yet in use** (R2) | Cache + rate-limit counters ONLY; never durable data (ADR 10) |
| Auth (R2) | **Session-based** (Spring Session JDBC → Postgres) | **No JWT** ever (ADR 9) |
| Jobs | Postgres job queue (`FOR UPDATE SKIP LOCKED`) | Never put must-not-lose jobs in Redis |
| Files | **AWS S3** — public bucket for cover images (live), private bucket for submissions (R2) | Pre-signed URLs; never proxy, never public user files |
| Repo | **pnpm + Turbo monorepo** — `github.com/hasmika123/beecompete` | `apps/api` is Gradle, not a pnpm member. Root scripts: `pnpm dev\|build\|lint\|typecheck\|test\|format` |
| Design | Gold `#F5C330` + ink `#030201`; display serif + Inter (self-hosted); pill buttons | `docs/design-brief.md` — ask for reference images before styling any new element type |

**Hosting topology:** one IONOS VPS runs Docker Compose stacks — a single shared **edge Caddy**
(owns ports 80/443, routes by hostname on the `web_edge` network) + `staging` and `prod` stacks
(web + api each; api stays on a private network). Neon is off-box. **Never add a second proxy on
80/443** — route any second app through the same Caddy.

---

## 3. Accounts & services inventory

Every external account the project depends on. All free-tier unless noted — **Neon is now paid**.

| Service | Used for | Cost | Watch out |
|---|---|---|---|
| **IONOS** | VPS M+ (4 GB, US East, Ubuntu 24.04, IP `74.208.212.158`) | **Paid monthly** | Must stay on the upgradeable **VPS+** line (not "Cloud VPS"). Upgrade in-place to L+ (8 GB) before co-hosting a 2nd app |
| **Cloudflare** | DNS, CDN/WAF, rate-limiting, **Access** (admin lock), Web Analytics, **Email Routing** (support@ → Gmail) | Free | SSL mode = Full (strict). Only 1 free rate-limit rule (now on `/suggest-a-`; re-point to `/login` at R2). Never delete the MX/SPF/DKIM DNS records |
| **Neon** | Postgres (staging + prod branches, one account) | **Launch — usage-based, no base fee** | $0.106/CU-h · $0.35/GB-mo storage. **No quota wall any more — and no automatic spend cap either.** The ONLY hard cap is each compute's autoscale max (prod 0.25–1 CU, staging 0.25–0.5 CU). Never leave the 16 CU default: pinned that is ~$1,240/mo. Expect **$4–8/mo**. Full rules: `setup-runbook.md` → "Neon cost controls" |
| **AWS** | S3 public-assets bucket (covers) + IAM user `beecompete-api-s3` | ~Free | Root MFA still TODO. Private submissions bucket comes at R2 |
| **GitHub** | Repo, Actions CI/CD, GHCR images, Issues | Free (→ Pro ~$4/mo) | Repo is **public for now** — make private + Pro (branch protection) before launch |
| **Brevo** | Email captures (digest/follow/host lists), transactional email (feedback → support@) | Free | Free tier caps daily sends (~300/day). API key must be `xkeysib-` (REST), NOT `xsmtpsib-` (SMTP) |
| **PostHog** | Product analytics (EU region, one project shared prod+dev) | Free | Session Replay / Autocapture / Dead clicks / Web vitals must stay **OFF** (minors' site) |
| **Sentry** | Error tracking — web browser + Next SSR + Spring API | Free | `sendDefaultPii:false`, no Session Replay — enforced in code, keep it that way |
| **UptimeRobot** | Uptime monitors (see §6) | Free | The DB probe must poll at **30–60 min**, never 5 min |
| **Domain** | `beecompete.com` (DNS on Cloudflare) | Annual renewal | Keep auto-renew on — losing the domain is fatal |
| **Google/Bing Webmaster** | Search Console + Bing — sitemap submission | Free | Only matters after the indexing flip (§10) |

---

## 4. Environments & deployment

**Pipeline = build-once-promote:**
- Push to `main` → **deploy-staging** builds the image (`:sha`) → refreshes staging automatically. Gated by repo variable `DEPLOY_ENABLED=true`.
- Push a release tag → **deploy-prod** promotes the **exact same image** to prod:
  ```
  git tag R1.3 && git push origin R1.3
  ```
- Current prod tag: **R1.2**. The `production` GitHub Environment must keep its **tag rule `R*`** or tag deploys are rejected.
- The **edge Caddy stack is NOT in CI** — after editing `infra/Caddyfile`, copy it to `~/beecompete-edge/` on the box and `caddy reload` manually.

**On the VPS** (login: `deploy@74.208.212.158`, SSH key-only; `root` also works with `~/.ssh/beecompete_admin`):
- `~/beecompete-staging/.env`, `~/beecompete-prod/.env` — all runtime secrets (chmod 600)
- `~/beecompete-edge/` — edge Caddy compose + Caddyfile
- Env changes require recreating the service: `docker compose -f docker-compose.prod.yml up -d web`
  — ⚠️ but `IMAGE_TAG` is injected by the deploy pipeline and is deliberately **not** in the prod
  `.env`, so that command alone aborts with *"set IMAGE_TAG to the promoted build"*. Export the
  running tag first — see the cheatsheet (§12) for the copy-paste form.

**Prod admin API access from your machine** (it's internal-only by design):
`tools/seeding/run-prod-submit.sh` automates the socat relay + SSH tunnel; details in the
`prod-api-access-for-seeding` memory note and `tools/seeding/README.md`.

**Local dev:** Postgres on port **15432** (5432/5433 are taken on this Windows box); `apps/web/.env.local`
needs `ADMIN_API_TOKEN` for `/admin`. Local infra: `infra/docker-compose.yml`.

---

## 5. Secrets — what exists and where it lives

Keep the master list in a **password manager** — never in the repo or Downloads.

| Secret | Lives in | Purpose |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` (+ usernames/passwords) | VPS `.env` per stack | Neon pooled (app) vs direct (Liquibase). Staging & prod are **different branches — never cross them** |
| `ADMIN_API_TOKEN` | VPS `.env` (different per env) + local `.env.local` | Web BFF → admin API shared secret; blank = fail closed |
| `BREVO_API_KEY` + list/template IDs | Prod VPS `.env` | Captures + feedback email (§6, §8) |
| `POSTHOG_KEY`, `CF_WEB_ANALYTICS_TOKEN` | Prod VPS `.env` + local `.env.local` | Analytics (staging deliberately has none) |
| `SENTRY_DSN` (API), `WEB_SENTRY_DSN` (web) | VPS `.env`; `WEB_SENTRY_DSN` also a **GitHub secret** (browser DSN bakes at build) | Error tracking |
| `S3_BUCKET`, `AWS_*` keys | VPS `.env` + `apps/api/.env.s3.local` | Cover-image uploads |
| `VPS_HOST`, `VPS_SSH_KEY`, GHCR token | GitHub Actions secrets | Deploy pipeline |
| SSH keys | `~/.ssh/beecompete_admin` (local machine) | VPS access |

⚠️ **Outstanding:** rotate the **Neon prod DB password** (it once sat in a plaintext local file).

---

## 6. Monitoring & where bugs are tracked

**Where to look when something's wrong (in order):**
1. **UptimeRobot** — two monitors: `beecompete.com/` (5 min, edge reachability) and
   `/api/healthz/db` (30–60 min, the only real DB round-trip). *The homepage can serve cached 200s
   with the DB dead — only the DB probe catches a Neon outage.* The DB probe is token-gated: it
   needs the `X-Healthz-Token` header matching `HEALTHZ_TOKEN` in the prod `.env`. **Reading it:**
   `401` = token problem (missing/wrong header, or the var unset on the box) — *not* an outage;
   `503` = real API/DB outage; `200` = healthy.
2. **Sentry** — runtime errors from browser + Next SSR + Spring API.
3. **Neon console** — compute-usage graph (quota burn) + connection state.
4. On the VPS: `docker ps` / `docker logs <container>` (JSON logs, 10 MB × 3 rotation).

**Where issues/work are tracked:**

| Kind | Where |
|---|---|
| Runtime errors | Sentry |
| Tasks / features | GitHub Issues (one per task ID from `phase-1-plan.md`) |
| User bug reports & feedback | `/feedback` form → email to **support@** (via Brevo) |
| Data corrections from visitors | Admin **corrections queue** (`CorrectionProposal`) |
| Competition suggestions from visitors | Admin **import queue** (badged `USER_REQUEST`) |
| Deferred/backlog items | `docs/sweep-remediation-plan.md` |
| Traffic / product analytics | Cloudflare Web Analytics + PostHog |

---

## 7. Recurring tasks

**Weekly**
- **S4 curation sprints** (until the 200-competition gate is met, then ongoing upkeep): run the S3
  extraction pipeline (`tools/seeding/`, works `docs/seeding/master-index.csv` top-down by rank),
  then review/approve in the admin import queue. Target ~20–30 approvals/day when sprinting.
  Curation is **permanent labor** — budget a few hours/week post-launch.
- **S5 freshness loop:** check for stale/passed Edition dates and re-verify listings on their annual cycle.
- **Weekly digest send:** manual, curated, from Brevo (automated matching sends are Phase 2 / M26).
- Clear the admin queues: import reviews, correction proposals, competition requests.
- Skim Sentry for new errors; skim the support@ inbox.

**Monthly**
- **Check the Neon usage graph** — confirm idle compute burn stays at a few h/day. Quota resets on the 1st.
- Verify the nightly `backup-neon.sh` cron is producing dumps (`~/backups` on the VPS, keeps 14).
- Glance at Cloudflare WAF events + analytics; check IONOS invoice went through.

**Annually**
- Domain renewal (auto-renew, but verify). Review AWS/IAM keys. Re-check VPS OS upgrades (unattended-upgrades handles security patches).

**Per-release / cadence rules**
- After ~5–10 light-loop merges and before every release tag: run a `/simplify` or `/code-review` pass.
- Before any release: re-read the compliance gate (`docs/compliance.md` §Launch gate).

**🥇 Golden rule (from the July 2026 outage):** **never point any frequent (≤5-min) healthcheck,
monitor, or cron at anything that touches the DB.** Each hit wakes Neon for ~5 min; a 5-min poll
keeps compute awake 24/7. On the free tier that exhausted the quota and took the DB down (twice —
July 29 and Aug 20); on Launch it silently bills instead, so the rule now protects the invoice rather
than uptime. Container healthchecks use `/actuator/health/liveness` (no DB); Hikari stays
`minimum-idle: 0`; the `/api/healthz/db` monitor runs at **60 min** (each hit wakes Neon ~5 min, so
the interval is a line item: 30 min ≈ $3.20/mo vs 60 min ≈ $1.60/mo).

---

## 8. Email & mailing lists

**Addresses**

| Address | Direction | How it works |
|---|---|---|
| `support@beecompete.com` | Inbound | Cloudflare Email Routing → your Gmail. Legal-page contact + feedback-form destination |
| `no-reply@beecompete.com` | Outbound | Brevo verified sender (`BREVO_SENDER_EMAIL`) — transactional + double-opt-in emails |
| `privacy@` / `legal@` | Future | Point at the same inbox before launch if counsel wants them |

DNS email records in Cloudflare (MX, SPF/DMARC TXT, `brevo…_domainkey` CNAME) are load-bearing — never delete.

**Brevo mailing lists** (three captures, all parent/16+-pitched, double opt-in):

| List | Fed by | Contact attributes |
|---|---|---|
| Weekly digest | Landing/How-it-Works/Categories digest band | `GRADE`, `INTEREST`, `STATE` |
| Competition follows | "Follow" on detail pages | `COMPETITION` |
| Host waitlist | "Are you the organizer?" CTA | `COMPETITION` |

Each capture is inert (shows "opening soon") unless its list ID env var is set. Follow-list contacts
convert to real accounts at R2-16. **R1 collects no other personal data — keep it that way until R2's consent flows exist.**

---

## 9. Quotas, renewals & keys to keep an eye on

Nothing has a hard expiry date, but these can silently run out or lapse:

| Item | Risk | Cadence |
|---|---|---|
| **Neon spend** | Usage-based, no quota wall. Cost is **idle burn, not traffic** — a compute that never sleeps is ~$19/mo; a viral day is cents. Capped only by each compute's autoscale max | Check the Neon usage graph monthly (see §7) |
| **Domain renewal** | Site + email gone | Annual — keep auto-renew + valid card |
| **IONOS billing** | VPS suspended | Monthly — keep payment method valid |
| **TLS certificates** | Auto-renewed by Caddy (Let's Encrypt) | Zero-touch; only breaks if DNS is flipped grey-cloud/misrouted |
| **Brevo daily send cap** | Digest sends throttle on free tier | Watch as lists grow; upgrade when digest > ~300/day |
| **PostHog / Sentry free events** | Data loss past quota | Glance quarterly |
| **GitHub Actions minutes** | CI stalls (free on public repos; metered when repo goes private) | Watch after the private flip |
| **`ADMIN_API_TOKEN` / Brevo key / AWS keys** | No expiry, but rotate if ever exposed | Rotate on incident; Neon prod password rotation is **already owed** (§5) |

---

## 10. 🚀 Launch gate — what's left before going public (R1-17)

The site is live but `noindex`. Three blockers, in any order:

1. **Legal (hard blocker)**
   - Privacy attorney reviews the 4 draft pages (Privacy, Terms, Cookies, Affiliate Disclosure) — especially the COPPA posture.
   - Form the **LLC**, then in `apps/web/src/lib/legal.ts`: set `OPERATING_ENTITY`, `GOVERNING_LAW_STATE`, flip `LEGAL_REVIEW_PENDING → false`, bump `LEGAL_LAST_UPDATED`.
2. **Content gate** — **≥ 200 competitions live** across the ~11 categories (≥ 15 each for majors), every listing with a verified current/upcoming Edition, top ~50 fully curated.
3. **Indexing flip** — set `SEARCH_INDEXING=on` in `~/beecompete-prod/.env` → recreate web → verify `robots.txt` + a page shows `index,follow` → confirm staging still blocks → submit `sitemap.xml` to Google Search Console + Bing.

Then **tag the release** — that's the public launch. Housekeeping to do alongside: rotate the Neon
prod password, repo → private + GitHub Pro + branch protection, AWS root MFA, verify the
per-slug OG image renders (30-sec `curl` check, runbook "Known gaps"), Brevo consent-email test.

**Also confirm the DB-probe monitor actually exists** (§6 describes two monitors; the July-2026
incident notes still list *"add that monitor"* as an open owner action, so verify rather than
assume). It is a **second, new** monitor — never repoint the homepage one:
- Set `HEALTHZ_TOKEN` (`openssl rand -hex 32`) in `~/beecompete-prod/.env`. Do this **before** the
  release deploys; today's prod ignores it, so there's no window where the monitor reads red.
- Add a **new** UptimeRobot HTTP(s) monitor on `https://beecompete.com/api/healthz/db` at
  **30–60 min**, carrying `X-Healthz-Token: <token>`. Custom headers are a **paid-plan** feature —
  on the free plan use the `?token=<token>` query form instead (it works, but the secret then lands
  in access/proxy logs). Use one transport, not both.
- ⚠️ **Never** set this monitor to the homepage's 5-min interval, and never replace the homepage
  monitor with it. Each hit wakes Neon ~5 min, so a 5-min poll keeps the compute awake 24/7 and
  re-creates the July quota outage by hand — while also losing site-up detection.
- After the deploy, verify: bare URL → `401`, tokenized → `200`.

**Before R2 (non-negotiable):** LLC + EIN + business bank account, **cyber-liability + E&O insurance
bound**, Neon PITR **enabled** (done at the plan level 2026-08-20) + one tested restore (still outstanding), counsel sign-off on the full COPPA consent flow.

---

## 11. Compliance guardrails (never break these)

- **No selling student data. No behavioral ad-targeting to minors.** Contextual targeting only, ever.
- **No 1:1 private messaging between adults/hosts and minors — ever.** Broadcast or public-moderated only.
- **Affiliate links always carry the disclosure** (FTC).
- **WCAG 2.1 AA** on all new public UI.
- Analytics stay **cookieless, anonymous, no replay/autocapture**.
- **Never paste organizers' prose** into listings — facts are free, descriptions are written fresh (copyright).
- Never imply endorsement/affiliation with listed organizers (the footer disclaimer + trust badges do this work).
- 🛑 **Do not design or build ahead** on Judging (H12–H17, H25) or science-fair compliance (HC*) — they're gated to Phase-3 deep-dives.

---

## 12. Command cheatsheet

```bash
# Deploy to prod (promotes the staging-tested image)
git tag R1.3 && git push origin R1.3

# SSH to the VPS. The -i is REQUIRED: the keys use non-default names, so OpenSSH auto-offers
# nothing and a bare `ssh deploy@…` fails with "Permission denied (publickey)".
# Always the IP — never `ssh deploy@beecompete.com`: the domain is Cloudflare-proxied and
# resolves to CF edge IPs, which don't answer SSH. (A ~/.ssh/config `Host bc-prod` entry with
# IdentityFile + IdentitiesOnly makes this a bare `ssh bc-prod`.)
ssh -i ~/.ssh/beecompete_deploy deploy@74.208.212.158

# Recreate prod web after an .env change (on the VPS) — e.g. the SEARCH_INDEXING flip at launch.
# IMAGE_TAG is injected by the deploy pipeline and is NOT in the prod .env, so a bare `up -d web`
# aborts with "set IMAGE_TAG to the promoted build". Recover the running tag first:
cd ~/beecompete-prod
export IMAGE_TAG=$(docker inspect --format '{{.Config.Image}}' beecompete-prod-web-1 | sed 's/.*://')
docker compose -f docker-compose.prod.yml up -d web

# Manual Neon backup (on the VPS; nightly cron also runs it)
~/scripts/backup-neon.sh

# Seeding: submit extracted competitions to the prod import queue (from dev machine)
tools/seeding/run-prod-submit.sh

# Local dev (root of repo)
pnpm dev
```

---

## 13. Doc map — where the deep detail lives

| Question | Doc |
|---|---|
| How is it deployed? every infra gotcha | `docs/setup-runbook.md` (**"AS BUILT"** section is authoritative) |
| What's the task list / what's next? | `docs/phase-1-plan.md` |
| System design + ADRs | `docs/architecture.md` |
| Data model rules | `docs/domain-model.md` |
| What features are in/out of scope? | `docs/feature-registry.md` |
| Legal/regulatory map | `docs/compliance.md` |
| Design system + locked decisions | `docs/design-brief.md`, `docs/page-blueprints.md` |
| Page structures (hero pages) | `docs/page-blueprints.md` |
| Seeding data + methodology | `docs/seeding/`, `tools/seeding/README.md` |
| Deferred/backlog items | `docs/sweep-remediation-plan.md` |
| Canonical terms | `docs/glossary.md` |
| Working rules for AI sessions | `CLAUDE.md` |
