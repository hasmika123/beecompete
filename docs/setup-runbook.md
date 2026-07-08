# BeeCompete — External Setup Runbook

**Status:** Living document · **Last updated:** 2026-07-06 · **Type:** Runbook

The **manual, external setup steps** (accounts, servers, DNS, keys) that aren't code. Follow these
**when it's time** — I'll walk you through each *live* when we reach it (many steps need your logins).
Each section lists **when** it's needed, the **steps**, and the **outputs to save** (into env/secrets,
never committed).

> **Order of need:** Foundation → (R1) domain, Cloudflare, VPS, Postgres, deploy, S3, analytics, Sentry
> → (R2) email fully + Redis → (Phase 2) Stripe.

---

## 0. Ground rules
- Every credential/URL these produce goes into **environment variables / GitHub Actions secrets**, never the repo.
- Keep a private `secrets.md` **outside** the repo (or a password manager) listing what lives where.

## 1. GitHub repo + branch protection  *(Foundation)*
1. Create the repo (private to start).
2. Push the monorepo skeleton.
3. **Settings → Branches → Add rule** for `main`: require PR before merge, require **status checks (CI)** to pass, require branches up to date, no direct pushes, no force-push.
4. Settings → Actions: allow GitHub Actions; add repo **secrets** (filled in as later steps produce them).
- **Outputs:** repo URL; branch protection on `main`.

## 1b. Legal foundation  *(before R1 goes public — not needed to start coding)*
A minors-facing, payments-bound platform should not launch publicly as an unincorporated individual.
1. **Form an entity** (LLC is the usual fit) — personal-liability shield; required before public traffic, absolutely before payments (Phase 2).
2. **Insurance:** quotes for **cyber-liability** and **E&O**; bind before real user data exists (R2 at the latest).
3. **Trademark search** on "BeeCompete" (USPTO search + web/domain scan) **before** investing further in the brand; decide on filing later.
4. Open a **business bank account** (Stripe will need it in Phase 2 anyway).
- **Outputs:** entity docs; insurance policy; trademark-search notes.
- **Gotcha:** do the trademark search *before* buying the domain and brand assets, not after.

## 1b. Business & legal foundation  *(trademark: before domain · LLC + insurance: before R2)*
> ⚠️ Not legal/tax advice — consult an attorney + accountant. Operating a minors-facing, payments-handling service as an **individual** is real **personal-liability exposure**; the entity + insurance exist to contain it.

**Trademark & name check — before committing to the name/domain:**
1. Search **USPTO TESS** for "BeeCompete" and close variants in relevant classes (Class 42 SaaS, Class 41 education/competitions); check for conflicts.
2. Check **domain + social-handle** availability consistently across platforms.
3. If clear → consider a **trademark attorney** consult and, later, an **intent-to-use (1-B) application** to protect the mark. If there's a conflict → **rename now**, before any brand investment.
- **Output:** a cleared name (or a decision to rename) *before* buying the domain (§2).

**Legal entity — before R2 (before collecting minors' PII):**
1. Form an **LLC** (home state, or DE/WY) — separates personal assets from business liability.
2. Get an **EIN** (IRS), an **operating agreement**, and a **business bank account** — keep finances separate (don't pierce the veil).
3. Sign all vendor terms (Stripe, hosting, Brevo, etc.) as the **LLC**, not personally.
- **Output:** LLC + EIN + business bank account.

**Insurance — before R2 / by public launch:**
1. Get quotes for **cyber liability** (data-breach — critical with minors' PII), **E&O / professional liability** (service errors/failure), and **general liability**.
2. **Bind coverage before you hold real user data or take payments.**
- **Output:** active policies.

**Timing:** R1 (browse-only — no accounts, PII, or payments) is low-exposure, so it can launch first. But **R2 handles children's PII**, so the entity + insurance **must be in place before R2**.

## 2. Domain + DNS  *(R1)*
0. **Before buying — complete the trademark + name-availability check (§1b).** Don't invest in a domain/brand until the name is cleared.
1. Buy the domain (Cloudflare Registrar is cheapest/at-cost, or any registrar).
2. Add the domain as a **site in Cloudflare** (step 3); point the registrar's **nameservers to Cloudflare**.
3. Add DNS records later (A record → VPS IP; MX/TXT for email in step 7).
- **Outputs:** domain name; Cloudflare-managed DNS.
- **Gotcha:** nameserver propagation can take a few hours.

## 3. Cloudflare (CDN · WAF · Analytics)  *(R1)*
1. Add site → choose Free plan.
2. **DNS:** A record `@`/`www` → VPS IP (proxied = orange cloud ON, so WAF/CDN apply).
3. **SSL/TLS:** set to **Full (strict)** (works with Caddy's real certs).
4. Enable **WAF** managed rules + **Bot Fight Mode**; set a basic **rate-limiting rule** on `/login`,`/signup`.
5. Turn on **Web Analytics** (free, cookieless) → get the snippet for the web app.
- **Outputs:** Cloudflare account; Web Analytics token.

## 4. VPS server  *(R1)*
1. Provision a VPS (Hetzner/DigitalOcean/etc., ~$5–10/mo to start).
2. **Harden:** create a non-root sudo user; SSH **key-only** (disable password login); enable **UFW firewall** (allow 22, 80, 443); enable `fail2ban`; enable unattended security updates.
3. Install **Docker Engine + Docker Compose**.
4. Install **Caddy** (or run it as a container) for auto-HTTPS reverse proxy.
5. Add the deploy SSH key (from step 8) to the deploy user's `authorized_keys`.
- **Outputs:** VPS IP; SSH access; Docker + Caddy running.
- **Gotcha:** *don't* run the production database here — use managed Postgres (step 5).

## 4b. Staging environment  *(R1 — lives on the same VPS)*
Staging is a **second Docker Compose stack on the same VPS**, *not* a separate server.
1. **DNS:** Cloudflare A record `staging` → **same VPS IP**. Keep it **private + non-indexed**: put it behind **Cloudflare Access** (email allow-list) or HTTP basic-auth, and serve `X-Robots-Tag: noindex` + a `robots.txt` disallow (so staging never competes with prod in search).
2. **Certs:** Caddy auto-issues HTTPS for `staging.<domain>` too — nothing extra.
3. **Containers:** a `docker-compose.staging.yml` with its own container names / network / ports and `:staging`/`:sha` image tags, running alongside the prod stack.
4. **Data:** a **separate staging database** (a second Neon project/branch — free tier) + a **separate S3 prefix/bucket**. **Never point staging at prod data** — seed it with synthetic/sample data; **no real minors' PII on staging.**
5. **Secrets:** a separate GitHub **Environment `staging`** with its own env (staging `DATABASE_URL`, etc.), distinct from `production`.
- **Cost:** ~**$0 extra** — it shares the VPS and the staging DB is on a free tier. Bump the VPS one size if the two stacks strain it; graduate staging to its own host only if its load ever risks prod.
- **Outputs:** `staging.<domain>` reachable + private; staging `DATABASE_URL`; `staging` GH Environment.

## 5. Managed Postgres  *(R1)*
1. Create a **Neon** project (free tier) → get the connection string.
2. Create separate databases/branches for **staging** and **production**.
3. Before real users: upgrade to a **paid tier** with automated backups + **PITR**; run one **test restore**.
4. **Pick a Neon region close to the VPS** (Hetzner EU ↔ a Neon EU region) — cross-region DB latency compounds on every query.
5. Capture **two** connection strings: the **pooled `-pooler` URL** (`DATABASE_URL`, for the app **including the job queue** — `FOR UPDATE SKIP LOCKED` is transaction-scoped, so it's pooler-safe) and the **direct URL** (`DIRECT_URL`, for **Liquibase migrations + any session-scoped ops** — advisory locks / LISTEN-NOTIFY, if ever used).
6. **Tune HikariCP for serverless:** modest pool size; `max-lifetime`/`idle-timeout` under Neon's idle window; validation on; cold-start-tolerant `connection-timeout`.
7. On the **paid prod tier, consider disabling autosuspend** to eliminate cold starts.
- **Outputs:** `DATABASE_URL` (pooled) + `DIRECT_URL` (direct), for staging + prod.
- **Gotcha:** enforce SSL (`sslmode=require`); don't run migrations through the pooler.

## 6. AWS S3 (private files)  *(R1/R2)*
1. Create an AWS account; create a **private S3 bucket** (block all public access).
2. Create an **IAM user/role** with least-privilege access to just that bucket; generate keys.
3. App uses the SDK to issue **pre-signed URLs** (short TTL) — never make the bucket public.
- **Outputs:** `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, region.

## 7. Email: Brevo + Cloudflare Routing  *(R1 basic; R2 critical)*
1. **Brevo** account → get **SMTP** credentials (for `no-reply@` transactional mail).
2. In Cloudflare DNS, add Brevo's **SPF, DKIM, DMARC** records (Brevo provides them) → verify the domain.
3. **Cloudflare Email Routing:** route `support@yourdomain` → your Gmail (inbound).
4. Send a test: verification email + consent email must land in inbox (not spam).
- **Outputs:** `SMTP_HOST/PORT/USER/PASS`; verified sending domain.
- **Gotcha:** deliverability is **critical for the COPPA consent email** — don't skip DKIM/DMARC.

## 8. Deployment pipeline  *(R1)*
1. Enable **GHCR** (GitHub Container Registry) for the repo's images.
2. Add **Actions secrets:** `VPS_HOST`, `VPS_SSH_KEY`, `GHCR_TOKEN`, plus app env (`DATABASE_URL`, `SMTP_*`, `S3_*`, etc.).
3. Write the **Caddyfile** on the VPS (reverse-proxy → Next + Spring containers, auto-HTTPS).
4. **Two deploy workflows (this is how `main` ≠ prod):**
   - **`deploy-staging.yml` — trigger `on: push: branches: [main]`:** build image (`:sha`) → push GHCR → SSH → `docker compose -f docker-compose.staging.yml pull && up -d` → migrate **staging** DB → health check. Uses the `staging` Environment.
   - **`deploy-prod.yml` — trigger `on: push: tags: ['R*']` (+ `workflow_dispatch`):** **re-tag the already-tested `:sha` image** as the release → SSH → `docker compose -f docker-compose.prod.yml …` → migrate **prod** DB → health check. Uses the `production` Environment (optionally require a manual approval reviewer).
   - **Net effect:** a plain merge to `main` deploys **only staging**; **production updates only when you deliberately push a release tag** (`git tag R1 && git push origin R1`), shipping the *exact* image staging validated (**build once, promote**).
5. First deploy can use **sslip.io** for a real cert on the bare IP before DNS is live.
- **Outputs:** `main` push → staging auto-deploy; **release tag → prod** (manual, deliberate).

## 9. Observability  *(R1)*
1. **Sentry** project for web + API → get DSNs.
2. **Uptime monitor** (UptimeRobot/BetterStack free) on the health endpoint.
- **Outputs:** `SENTRY_DSN` (web + api); uptime alerts to email.

## 10. Redis  *(R2; R1 if rate-limiting early)*
1. Add a **Redis** container to Compose (or a managed Redis).
2. Used for **cache + rate-limit counters only** — sessions and the job queue live in **Postgres** (architecture ADR 9/10), so Redis holds nothing durable and needs no persistence config.
- **Outputs:** `REDIS_URL`.

## 11. Privacy analytics  *(R1)*
1. **Cloudflare Web Analytics** (step 3) — add snippet to the web app.
2. **PostHog** (free tier, EU host) → project key; used for product analytics **and feature flags**.
- **Outputs:** `POSTHOG_KEY`; CF analytics token.

## 12. Stripe  *(Phase 2 — not needed for R1/R2)*
1. Stripe account → test + live keys; enable **Stripe Tax**; plan **Connect** for host fee collection later.
- **Outputs:** `STRIPE_SECRET_KEY`, webhook secret. *(Deferred — noted so it's not forgotten.)*

---

## Setup order checklist (do in this order)
**Foundation:** [ ] 1 repo+protection [ ] 1b legal foundation (must be done before R1 goes public) [ ] 1b trademark/name check
**R1:** [ ] 2 domain [ ] 3 Cloudflare [ ] 4 VPS [ ] 5 Postgres [ ] 6 S3 [ ] 8 deploy [ ] 9 Sentry [ ] 11 analytics [ ] 7 email(basic)
**Before R2 (business/legal):** [ ] 1b LLC + EIN + business bank [ ] 1b insurance (cyber / E&O / general)
**R2:** [ ] 7 email(consent-verified) [ ] 10 Redis
**Phase 2:** [ ] 12 Stripe
