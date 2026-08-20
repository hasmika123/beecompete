# BeeCompete — External Setup Runbook

**Status:** Living document · **Last updated:** 2026-07-18 · **Type:** Runbook

The **manual, external setup steps** (accounts, servers, DNS, keys) that aren't code. Follow these
**when it's time** — I'll walk you through each *live* when we reach it (many steps need your logins).
Each section lists **when** it's needed, the **steps**, and the **outputs to save** (into env/secrets,
never committed).

> **Order of need:** Foundation → (R1) domain, Cloudflare, VPS, Postgres, deploy, S3, analytics, Sentry
> → (R2) email fully + Redis → (Phase 2) Stripe.

> **§0–§12 below are the original prospective plan (kept for the reasoning).** For **what is actually
> running now**, the "Current deployment — AS BUILT" section immediately below is authoritative;
> where they differ, it wins.

---

## Current deployment — AS BUILT (LIVE, 2026-07-12)

**Live:** production `https://beecompete.com` (+ `www` 301→apex) · staging `https://staging.beecompete.com`.

**Host:** IONOS **VPS M+** (4 vCore / 4 GB / 120 GB), US East, Ubuntu 24.04, IP `74.208.212.158`,
login user `deploy` (SSH key-only, password auth off), 4 GB swapfile, UFW (22/80/443) + fail2ban +
unattended-upgrades. Managed Postgres is **off-box** (Neon); Redis not used yet.
- **IONOS specifics:** buy the upgradeable **VPS+** contract line, **not** "Cloud VPS" (PAYG, can't
  upgrade). In-place upgrade **M+ (4 GB) → L+ (8 GB)** is required before a **second app** co-hosts here
  (D12). IONOS may provision with an emailed root password (add SSH key on first login, then disable
  password auth). Its Cloud-Panel **Firewall Policy** must allow 22/80/443 in addition to UFW.

**Topology — ONE shared reverse proxy for the whole box (D13, supersedes §4/§8's per-host Caddy):**
- `infra/docker-compose.edge.yml` (project `beecompete-edge`) runs a **single Caddy** owning **80/443**
  on an external Docker network **`web_edge`**, routing **by hostname** via `infra/Caddyfile` (site
  blocks: `staging.beecompete.com`→`staging-web`, `beecompete.com`→`prod-web`, `www`→301 apex).
- `infra/docker-compose.{staging,prod}.yml` run **web + api only** (no Caddy). Each `web` joins
  `web_edge` under an alias (`staging-web`/`prod-web`); each Spring **api stays private** on the stack's
  `internal` network (BFF — only web is public). Neon is never in Compose.
- **Add a second app:** new stack's `web` on `web_edge` with its own alias + a site block in
  `infra/Caddyfile`, copy it to `~/beecompete-edge/` and `caddy reload`. **Never a 2nd proxy on
  80/443** (D10) — two proxies clashing on those ports is the exact failure that blocked the first deploy.

**On-box layout (as `deploy`):** `~/beecompete-staging/.env`, `~/beecompete-prod/.env` (both `chmod 600`),
`~/beecompete-edge/{docker-compose.edge.yml,Caddyfile}`. `web_edge` was created once
(`docker network create web_edge`). The **edge stack is managed manually** (not CI) — reload/restart it
by hand when the Caddyfile changes.

**Deploy flow (the §8 model, now live):** push to `main` → **deploy-staging** builds `:sha`+`:staging`
and refreshes staging (gated by repo **variable** `DEPLOY_ENABLED=true`). Release tag `R*`
(`git tag R1 && git push origin R1`) → **deploy-prod** promotes the **exact `:sha` image** (build once,
promote) → prod. The deploy workflows **no longer ship the Caddyfile** (it belongs to the edge stack).
- ⚠️ The `production` GitHub Environment needs a **Deployment branches-and-tags rule for Tag `R*`**,
  else the tag deploy is rejected ("not allowed to deploy to production").

**VPS `.env` format (Neon → Spring):** convert Neon's `postgresql://user:pass@host/neondb?...` →
`jdbc:postgresql://<host>/neondb?sslmode=require` (add `jdbc:`, drop `user:pass@`, **drop
`channel_binding=require`** — the JDBC driver rejects it); split `DATABASE_USERNAME/PASSWORD` and
`DIRECT_USERNAME/PASSWORD` out. Neon hosts include a **`.c-9.`** segment. Pooled (`-pooler`) = app
`DATABASE_URL`; direct (no `-pooler`) = Liquibase `DIRECT_URL`; pooled & direct share one password per
branch. Staging = `ep-spring-base-…`, prod = `ep-twilight-hat-…` (different branches — never cross them).
Do **not** set `IMAGE_TAG` in the prod `.env` (the pipeline injects it). `deploy` user is created
`--disabled-password`, so `passwd deploy` is required for `sudo`.
- **R1-3 addition:** both VPS `.env` files also need **`ADMIN_API_TOKEN`** (`openssl rand -hex 32`,
  different per env) — the shared secret the web BFF sends as `X-Admin-Token` on `/api/v1/admin/**`.
  Blank = admin API rejects everything (fail closed). The `/admin` browser route additionally goes
  behind **Cloudflare Access** (email allow-list) before real use — see R1-3 notes.

**DNS (Cloudflare):** `beecompete.com`, `www`, `staging` each = a single `A` → box IP. Issue the first
Let's Encrypt cert **grey-cloud (DNS-only)** — a proxied (orange) record blocks the ACME challenge — then
flip to **orange (proxied)** with **SSL/TLS = Full (strict)** (zone-wide). The old S3/GoDaddy `A`/`AAAA`
records were deleted (`132.148.79.209` + `3.169.173.x` + `2600:9000:…`); **email records (MX / SPF-DMARC
TXT / `brevo…_domainkey` CNAME) were kept.** After cutover, **purge Cloudflare cache** if a stale cached
site still shows. The old GoDaddy box (runs a separate app, `dossier`) is left untouched (D5).

**Known gaps / deferred:**
- **Search indexing is OFF (R1-10) — flip it at the R1-17 gate, not before.** The whole site
  serves `robots.txt: Disallow:/` + per-page `noindex` until `SEARCH_INDEXING=on` is set in
  `~/beecompete-prod/.env` and the web service is recreated (`docker compose -f
  docker-compose.prod.yml up -d web` — env changes require recreate, which also clears the ISR
  cache so cached noindex HTML can't linger). ⚠️ **That recreate needs `IMAGE_TAG` exported
  first** — the pipeline injects it and it is deliberately absent from the prod `.env`, so the
  bare command aborts with *"set IMAGE_TAG to the promoted build"*. Recover the running tag:
  `export IMAGE_TAG=$(docker inspect --format '{{.Config.Image}}' beecompete-prod-web-1 | sed 's/.*://')`.
  Then: verify `beecompete.com/robots.txt` + a
  page's robots meta, submit `sitemap.xml` to Google Search Console + Bing Webmaster Tools, and
  confirm staging still serves `Disallow:/` (staging's compose deliberately has no way to
  receive the flag). Full checklist lives in the R1-17 bullet of `docs/phase-1-plan.md`.
- **Verify the per-competition OG image renders in the real container (R1-10).** The dynamic
  `/c/<slug>/opengraph-image` route runs `next/og` (satori + wasm + embedded brand fonts) only at
  request time, so `next build` proves the static default card but not the per-slug runner path.
  Once the first S4-curated listing exists on staging: open its `/c/<slug>` page, copy the
  `og:image` URL from the HTML (it carries a build hash), and `curl` it — expect `200
  image/png`. A 500 means the satori/wasm assets didn't trace into the standalone image. 30-second
  check; do it after the first listing lands, before the R1-17 flip.
- ~~Web-side Sentry not wired.~~ **DONE 2026-07-18.** Web + API Sentry projects created; the web DSN is
  set as the GitHub secret **`WEB_SENTRY_DSN`** (bakes the browser `NEXT_PUBLIC_SENTRY_DSN` at build via
  deploy-staging's build-arg) **and** in the VPS `.env` (`WEB_SENTRY_DSN` → the web SSR side); the API DSN
  is `SENTRY_DSN` in the `.env`. The R1.2 rebuild baked the browser DSN — verified live on prod: browser +
  Next-SSR + Spring-API capture all fire. (`sendDefaultPii:false`, Session Replay off — enforced in code.)
- ~~On 4 GB, cap the API JVM heap in the stack env so it can't balloon.~~ **Done 2026-07-12:**
  every service in the deploy stacks now has a `mem_limit` (staging api 768m/web 384m; prod api
  1g/web 512m; edge caddy 192m), the API JVM gets `-XX:MaxRAMPercentage=75.0` so the heap sizes
  off the container limit, and all services have json-file log rotation (10m × 3). Takes effect
  per-stack on its next deploy; the edge stack needs a manual
  `docker compose -f docker-compose.edge.yml up -d` on the box.
- **Security:** rotate the Neon **prod** DB password (it briefly sat in a plaintext local file); keep the
  secrets sheet in a password manager, never in Downloads/repo.
- **R1-17 launch activation — DONE 2026-07-18:** privacy-first analytics (§11), Brevo captures (§7a),
  admin behind Cloudflare Access + `ADMIN_API_TOKEN` (§5), Cloudflare **WAF + rate-limiting** (managed
  ruleset auto-on + Bot Fight Mode + one rate-limit rule on `/suggest-a-`), **UptimeRobot** on
  `beecompete.com/` (the API is private/BFF, so `/actuator/health` isn't public — the monitor polls the
  homepage instead), and Sentry (above) are all live. Neon was free-tier here; it moved to the
  **Launch plan on 2026-08-20** after a second quota exhaustion (INCIDENT below). `scripts/backup-neon.sh`
  remains the logical-backup net, but **instant restore / PITR is now cheap** ($0.20/GB-month on a
  sub-1 GB database) and no longer has to wait for R2 — enable it and run one test restore.
- **INCIDENT 2026-07-29 — Neon free-tier compute quota exhausted; DB down for days, monitoring blind.**
  Both stacks share one Neon account; three independent always-on loops kept BOTH computes from ever
  autosuspending (free tier ≈ 191.9 compute-h/mo; two 0.25-CU computes awake 24/7 ≈ 360): **(a)** the
  docker healthchecks hit the `/actuator/health` aggregate (includes the DataSource ping) every 15 s ×
  2 stacks; **(b)** Hikari `minimum-idle: 2` + `max-lifetime` 4 min re-dialed Neon every ≤4 min even at
  zero traffic; **(c)** homepage/public pages are dynamic, though their reads mostly hit Next's hourly
  data cache. Meanwhile `beecompete.com/` kept serving 200s from that stale data cache, so UptimeRobot
  never fired. **Fixes (in repo, land on next deploy):** compose healthchecks → `/actuator/health/liveness`
  @30 s (no DB touch); Hikari `minimum-idle: 0` (pool drains → Neon can suspend); new public probe
  **`/api/healthz/db`** (web BFF → API health aggregate, real DB round-trip, 200/503) for a second
  UptimeRobot monitor at **30–60 min** (§9.3). **Owner actions:** add that monitor; check the Neon console
  usage graph to confirm the burn profile; quota resets Aug 1 (or upgrade the plan to restore service
  sooner). With the fixes, idle burn should drop to a few compute-h/day — re-check the Neon usage graph
  mid-August.
- **INCIDENT 2026-08-20 — free quota exhausted AGAIN; staging 502, every deploy failing.** The July
  fixes were committed (`3c99410`) but **never deployed to prod**, which kept running `R1.2` with
  `/actuator/health` @15 s + Hikari `minimum-idle: 2` and burned the whole month's quota on its own
  (~180 compute-h — as predicted above, one compute nearly eats the free allowance). Liquibase then
  could not connect, so the API never started, the container never went healthy, and
  `up -d --wait` failed **every** staging deploy. Prod still served 200s off Next's data cache; only
  staging's 502 was visible. **Deadlock:** the fix needs the DB, the DB needs quota. Resolved by
  upgrading to **Launch** and re-running the failed deploy (`gh run rerun <id> --failed`).
  ⚠ **Two prod burn causes are fixable ON THE BOX with no deploy** — worth knowing next time a deploy
  is blocked: set `DB_POOL_MIN=0` in `~/beecompete-prod/.env` (R1.2's `application.yml` reads
  `${DB_POOL_MIN:2}` and the api service has `env_file: [.env]`), and edit the healthcheck in
  `~/beecompete-prod/docker-compose.prod.yml` to `/actuator/health/liveness` @30 s.

### Neon cost controls (Launch plan, from 2026-08-20) — READ BEFORE CHANGING COMPUTE SETTINGS

Launch is **pure usage-based: no base fee, no minimum.** $0.106/CU-hour compute · $0.35/GB-month
storage · $0.20/GB-month instant restore · 10 branches included (we use 2), then $1.50/branch-month.

**The free tier's 0.25 CU ceiling was an accidental cost cap — and it is gone.** Launch autoscales to
**16 CU**, which pinned is ~$1.70/hour (~$1,240/month). Nothing stops that automatically: Neon's
spending controls on Launch are **notifications, not a hard shutoff**. The only real cap is
`autoscaling_limit_max_cu`, which Neon guarantees a compute will never exceed "even during traffic
spikes". **Set it per compute** (Console → the compute → *Edit compute* → autoscaling range):

| Autoscale max | Absolute worst case (pinned 24/7 all month) |
|---|---|
| 0.5 CU | ~$39/mo |
| **1 CU** ← prod | **~$77/mo** |
| 2 CU | ~$155/mo |
| 16 CU (default — do NOT leave this) | ~$1,240/mo |

Current settings: **prod 0.25–1 CU, staging 0.25–0.5 CU.** Worst case is then ~$116/mo in a scenario
that cannot actually occur (it assumes zero suspension all month); realistic spend is **$4–8/mo**.

**Cost here is driven by IDLE BURN, NOT TRAFFIC — internalize this, it is counter-intuitive.** Detail
pages are ISR (`revalidate = 3600`), so 10 000 visitors to one page in an hour cost **one** query;
Cloudflare fronts everything; the API is not publicly routable; captures go to Brevo, not Neon. A
viral day costs cents. What cost ~$19/mo was a compute that never slept, with no traffic at all.
- **The one traffic-scaling surface is `/competitions`** (+ `/competitions/[category]`) — `ƒ Dynamic`,
  so every filtered search is a DB query. Put a **Cloudflare Cache Rule** on it (even 60 s collapses a
  spike into one query/minute) **before flipping `SEARCH_INDEXING`** and inviting crawlers in. Cache
  Rules are on the free CF plan and are separate from the single free rate-limit rule.
- **Keep the `/api/healthz/db` monitor at 60 min, not 30.** Each hit wakes Neon ~5 min, so the
  interval *is* a line item: 30 min ≈ $3.20/mo, 60 min ≈ $1.60/mo.
- The golden rule from the July incident is unchanged and now costs money instead of causing an
  outage: **never point a ≤5-min monitor, healthcheck, or cron at anything that touches the DB.**
- **Still open before the public launch** (the R1-17 gate — `phase-1-plan.md`): privacy-counsel review of
  the legal pages + fill entity/governing-law + flip `LEGAL_REVIEW_PENDING`; the content gate (≥ 200
  seeded — start it with `cd tools/seeding && bash run-prod-submit.sh`, which tunnels to the internal
  prod API and fills the `/admin/import-records` queue; then curate/approve. Steps + caveats in the
  R1-17 content-gate bullet of `phase-1-plan.md`); the indexing flip + sitemap submit. Plus
  housekeeping: rotate the Neon **prod** DB password;
  repo → private + Pro (branch protection); AWS root MFA + no root keys; Brevo consent-email test (for
  R2's account flows).

**Decisions D1–D13** (full log in git history): D1 repo public-for-now (revert before launch) · D2 CF
rate-limit 5/10s · D3 dedicated `deploy` user · D4 harden on the real box · D5 own dedicated server ·
D6 no Neon Auth · D7 separate S3 buckets · D8 no Brevo SPF (DKIM + CF Email Routing SPF) · D9 ~~Hetzner~~
(→D11) · D10 shared Caddy for any 2nd app · D11 provider = **IONOS** (Hetzner raised prices) · D12 start
**M+ 4 GB → in-place upgrade to L+ 8 GB** before a 2nd app · D13 **shared edge Caddy implemented**.

---

## 0. Ground rules
- Every credential/URL these produce goes into **environment variables / GitHub Actions secrets**, never the repo.
- Keep a private `secrets.md` **outside** the repo (or a password manager) listing what lives where.

## 1. GitHub repo + branch protection  *(Foundation)*
1. Create the repo (private to start).
2. Push the monorepo skeleton.
3. **Branch protection on `main`** — require PR before merge, require **status checks (CI)** to pass, up-to-date branches, no direct pushes, no force-push.
   - ⚠️ **Free-plan reality (confirmed 2026-07-07):** branch protection **and** rulesets are unavailable on **private** repos on the Free plan (both return "upgrade to Pro or make public"). Options: **(a)** keep private + **defer protection until GitHub Pro (~$4/mo)** — do this when CI matters; **(b)** make the repo public (free protection + unlimited Actions, but exposes the strategy corpus — not chosen); **(c)** stay unprotected through Foundation.
   - **Decision:** protection is **premature until F5 anyway** — enforcing "require the `ci` check" before `ci.yml` exists would block your own Foundation commits. So: **stay private + unprotected through Milestone F; at F5 (CI lands), upgrade to Pro and enable protection** (or revisit public). CI still *runs* on PRs meanwhile; only *enforcement* waits.
4. Settings → Actions: allow GitHub Actions; add repo **secrets** (filled in as later steps produce them).
- **Outputs:** repo URL; branch protection deferred to F5 (see above).

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
1. Create a **Neon** project → get the connection string. (We started free-tier and moved to
   **Launch** on 2026-08-20 — see the cost-control rules above before sizing any compute.)
2. Create separate databases/branches for **staging** and **production**.
3. Before real users: **PITR / instant restore on** + run one **test restore**. (Done at the plan
   level 2026-08-20; the test restore is still outstanding.) **Set the autoscaling max on every
   compute at creation time** — the default 16 CU is an unbounded bill.
4. **Pick a Neon region close to the VPS** (Hetzner EU ↔ a Neon EU region) — cross-region DB latency compounds on every query.
5. Capture **two** connection strings: the **pooled `-pooler` URL** (`DATABASE_URL`, for the app **including the job queue** — `FOR UPDATE SKIP LOCKED` is transaction-scoped, so it's pooler-safe) and the **direct URL** (`DIRECT_URL`, for **Liquibase migrations + any session-scoped ops** — advisory locks / LISTEN-NOTIFY, if ever used).
6. **Tune HikariCP for serverless:** modest pool size; `max-lifetime`/`idle-timeout` under Neon's idle window; validation on; cold-start-tolerant `connection-timeout`.
7. On the **paid prod tier, consider disabling autosuspend** to eliminate cold starts.
- **Outputs:** `DATABASE_URL` (pooled) + `DIRECT_URL` (direct), for staging + prod.
- **Gotcha:** enforce SSL (`sslmode=require`); don't run migrations through the pooler.

## 6. AWS S3  *(two asset classes, two buckets — architecture §2 Files)*

### 6a. Public display-assets bucket — cover images  *(R1-19, ✅ provisioned 2026-07-16)*

Covers need stable, cacheable, indexable URLs (cards/detail/OG/ISR), so they live on a **public-read**
bucket — NOT the private user-files bucket. Upload is a pre-signed PUT; the browser uploads directly.

1. **Bucket:** create e.g. `beecompete-public-assets` (name globally unique), region near the VPS,
   Object Ownership = ACLs disabled. **Uncheck "Block all public access"** (this bucket holds only
   public display images).
2. **Bucket policy** — public read on the `covers/` prefix only:
   `Allow s3:GetObject, Principal "*", Resource arn:aws:s3:::<bucket>/covers/*`.
3. **CORS** — methods `PUT, GET, HEAD`; `AllowedOrigins` = the app origins
   (`https://beecompete.com`, `https://staging.beecompete.com`, `http://localhost:3000`); headers `*`.
4. **IAM user + least-privilege key:** user `beecompete-api-s3`, inline policy `Allow s3:PutObject on
   arn:aws:s3:::<bucket>/covers/*` only; create an access key (secret shown once). Enable root MFA.
5. **Env** (API — both VPS `.env` files + local `apps/api/.env.s3.local`, never committed):
   `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`
   (`https://<bucket>.s3.<region>.amazonaws.com`, or a CDN origin). The API's `env_file: [.env]` picks
   them up (§2); the deploy workflow does NOT inject app env from GitHub secrets. Blank bucket =
   feature off (endpoint 503s, paste-a-URL fallback stays).
- **Verified E2E 2026-07-16:** presign → PUT 200 → public GET 200; CORS preflight 200 for the app
  origin. A CDN in front of the bucket is a later optimization, not required.

### 6b. Private user-files bucket — submissions  *(R2, not yet built)*

1. Separate **private** bucket, **block all public access** ON.
2. IAM least-privilege (Put + Get on that bucket); the app issues short-TTL **pre-signed GETs** for
   downloads — never public (minors' submissions). Reuses the SDK/presigner pattern from 6a.
- **Outputs:** its own `*_BUCKET` + reuses the AWS key (or a separate least-privilege key).

## 7. Email: Brevo + Cloudflare Routing  *(R1 basic; R2 critical)*
1. **Brevo** account → get **SMTP** credentials (for `no-reply@` transactional mail).
2. In Cloudflare DNS, add Brevo's **SPF, DKIM, DMARC** records (Brevo provides them) → verify the domain.
3. **Cloudflare Email Routing:** route `support@yourdomain` → your Gmail (inbound).
4. Send a test: verification email + consent email must land in inbox (not spam).
- **Outputs:** `SMTP_HOST/PORT/USER/PASS`; verified sending domain.
- **Gotcha:** deliverability is **critical for the COPPA consent email** — don't skip DKIM/DMARC.

### 7a. Listing-page email captures — Brevo API  *(R1-15 digest · R1-15b follow + host — code is DONE; this is the owner setup to switch them on)*
Three captures share one Brevo account (the API + contact lists, not SMTP): the weekly **digest**
(R1-15), per-competition **follow** (R1-15b, M29), and host-interest **"claim this competition"**
(R1-15b, H46). **Each is inert until its list id is set** (the form shows "opening soon"); all are
pitched to parents/educators/16+ (host = organizers) and use **double opt-in** when the template is
configured. Wire only the captures you want live.
1. **API key:** Brevo → **SMTP & API → API keys** tab → create a key. Server-only secret →
   `BREVO_API_KEY` (never `NEXT_PUBLIC_`).
   - **⚠️ Gotcha (verified 2026-07-17):** this must be the **REST API v3 key that starts with
     `xkeysib-`** — NOT the **SMTP key** (`xsmtpsib-`) from step §7. They're different credentials;
     the SMTP key returns `401 {"code":"unauthorized","message":"Key not found"}` against the
     contacts API. If auth fails, check the prefix first.
2. **Lists:** Brevo → **Contacts → Lists** → create three (e.g. "Weekly digest", "Competition
   follows", "Host waitlist") → copy each numeric id → `BREVO_DIGEST_LIST_ID`,
   `BREVO_FOLLOW_LIST_ID`, `BREVO_HOST_WAITLIST_LIST_ID`. They stay **separate** on purpose: a
   blended list can't be mailed without spamming the other two audiences.
   *(`BREVO_HOST_LIST_ID` is the pre-R1-15c name for the host waitlist and is still read as a
   fallback, so an existing prod env keeps working until you rename it.)*
3. **Contact attributes:** Brevo → **Contacts → Settings → Contact attributes** → create **four
   text attributes**: **`COMPETITION`** (see below) and **`GRADE`, `INTEREST`, `STATE`** (the
   digest signup's optional preference popup, rev 2026-07-26 — asked after the email step, stored
   for curator insight + M26 segmentation; the R1 send itself stays one curated email for
   everyone). Brevo rejects contacts with undefined attributes — a missing one triggers the
   attribute-retry (signup kept, preferences dropped, Sentry event).

   **`COMPETITION` holds a LIST, delimiter-wrapped:** `|AMC 10|MATHCOUNTS|`. A Brevo attribute has
   one slot per *contact* (not per list), so a follower's second competition would otherwise
   overwrite the first and silently stop mailing them about it. To segment, filter on
   **`COMPETITION` contains `|AMC 10|`** — include the pipes, or "AMC 10" also matches a listing
   named "AMC 10/12". Type must be **text**: *multiple-choice* would be a truer fit but requires
   every competition pre-registered as an option, i.e. a sync job that silently drops follows
   whenever it lags behind the catalog.

   Only the **Follow** capture writes `COMPETITION`. The host-waitlist opt-in on a Claim Request
   deliberately writes no attributes, because attributes are per-contact and it would clobber the
   follow list of a claimant who also follows competitions.
4. **Double opt-in (recommended):** create one transactional **"confirm your subscription" template**
   (Brevo → Campaigns → Templates) whose confirm button uses Brevo's **double opt-in link tag** →
   copy its id → `BREVO_DOI_TEMPLATE_ID` (shared across all three list captures). Without it,
   single opt-in.
   **Do NOT set a redirect URL here or in the env.** Where a subscriber lands after confirming is a
   per-API-call field, so the app sends each flow to its own `/subscribed/<flow>` page derived from
   `SITE_URL` — which also means a staging confirmation lands on staging. `BREVO_DOI_REDIRECT_URL`
   was **removed at R1-15c**; delete it from any `.env` that still has it (a stale value would have
   pointed all three flows at the same page).
5. **Claim inbox:** `HOST_CLAIM_EMAIL` (e.g. `admin@beecompete.com`) — where "Claim this
   competition" requests are emailed. This is a **form → inbox**, not a list: no list id, no double
   opt-in, no confirmation page. Unset falls back to the support address so a claim is never lost.
   Needs `BREVO_SENDER_EMAIL` set (same verified-sender requirement as feedback, below).
6. **Set them in `~/beecompete-prod/.env`** and recreate web (the compose passes them through):
   `BREVO_API_KEY`, `BREVO_DIGEST_LIST_ID`, `BREVO_FOLLOW_LIST_ID`, `BREVO_HOST_WAITLIST_LIST_ID`,
   `BREVO_DOI_TEMPLATE_ID`, `HOST_CLAIM_EMAIL`.
7. **Verify:** submit the Landing digest band, the Landing **host waitlist** band (`#hosts`), a
   detail page's **Follow**, and a detail page's **Claim**. The three list captures each echo the
   address back ("we sent a confirmation link to …") and, after you click confirm in the email,
   land on `/subscribed/digest`, `/subscribed/follow`, or `/subscribed/hosts` respectively — not the
   site root. The claim form instead emails `HOST_CLAIM_EMAIL` with Reply-To set to the submitter.
- **Outputs:** `BREVO_API_KEY` + the three list ids (+ shared DOI template) + `HOST_CLAIM_EMAIL` in
  the prod `.env`.
- **Note:** R1 ships **capture only** — the weekly send is manual/curated in Brevo (automated
  personalized matching = **M26, Phase 2**); email-followers convert to accounts at **R2-16**.
  Follow deliberately promises "when dates are announced or updated", not per-deadline reminders,
  because automated deadline alerts are M30/X11 in Phase 2.
- **Request-a-Competition** (Page 6) needs **no Brevo** — it posts to the import/curation queue.
- **In-app feedback** (R1-16, `/feedback`) reuses `BREVO_API_KEY` to email **support@** via Brevo
  transactional mail. The **"from" must be a verified sender/domain** (`BREVO_SENDER_EMAIL`, default
  `no-reply@beecompete.com`) — the same domain verification as the DOI email (§7). Inert without the
  key (the form tells visitors to email support@ directly). Richer Sentry-linked bug capture waits
  for the web Sentry client (the F8 `WEB_SENTRY_DSN` build-arg TODO).

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

**Code is wired (F8):** Sentry SDK on web + API and structured JSON logs ship in the images;
they're **inert until a DSN is set**. This section is the **operational half** — do it once staging
is live (§8).

1. **Sentry** project(s) for web + API → copy the DSNs. Put them in each environment's VPS `.env`:
   `SENTRY_DSN` (API + Next server), `NEXT_PUBLIC_SENTRY_DSN` (browser), `SENTRY_ENVIRONMENT` /
   `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (`staging`|`production`). Redeploy so the containers pick them up.
   - *(Optional, better stack traces):* set `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` as CI
     secrets so `deploy-*.yml` uploads source maps at build. Never commit the token.
   - **Privacy is enforced in code (COPPA): `sendDefaultPii: false`, no Session Replay** — keep it that way.
2. **Confirm capture:** trigger a test error on staging and verify it lands in Sentry (both a browser
   error and an API 500). Check JSON logs are flowing (`docker logs` on the api container shows one
   JSON object per line, `service:beecompete-api`).
3. **Uptime monitor** (UptimeRobot/BetterStack free) → TWO monitors (July 2026 lesson: the
   homepage stays 200 off Next's data cache even with the DB dead, so one homepage monitor is
   blind to a database outage):
   - `https://<domain>/` at 5 min — edge/web reachability (cheap, no DB).
   - `https://<domain>/api/healthz/db` at **30–60 min** — the only public URL doing a real
     Neon round-trip (200 UP / 503 DOWN). ⚠️ Never poll it at 5 min: each hit wakes Neon for
     ~5 min, so a 5-min interval keeps the compute awake 24/7 and burns the free-tier quota.
     🔒 **Token-gated, fail closed** (2026-08-19) — because that same "each hit wakes Neon"
     property made an ungated public URL a quota-burn lever for anything sweeping `/api/*`.
     Set `HEALTHZ_TOKEN` in the prod `.env` (`openssl rand -hex 32`), recreate web, then add it
     to the monitor as a custom header **`X-Healthz-Token: <token>`** (UptimeRobot → the
     monitor → Advanced/Request settings → custom HTTP headers). A `?token=<token>` query
     fallback works for monitors that can't set headers, but prefer the header: query strings
     land in access/proxy logs. **Reading the alert:** `401` = token missing/wrong (or
     `HEALTHZ_TOKEN` unset on the box), `503` = a genuine API/DB outage, `200` = healthy.
   (The Spring API is private/BFF — `/actuator/health` is not public; the probe route proxies it.)
- **Outputs:** DSNs live in each env; Sentry receiving events; uptime alerts on; JSON logs aggregating.

## 10. Redis  *(DEFERRED TO R2 — decided 2026-08-19, do NOT deploy at R1)*

**As-built at R1: Redis is not deployed anywhere.** It exists only in `infra/docker-compose.yml`
(local dev) — deliberately absent from the `.edge`/`.staging`/`.prod` stacks — and `apps/api` has
**no** Redis dependency in `build.gradle.kts` (no `spring-boot-starter-data-redis`, no bucket4j, no
rate-limit library). So there is **no application-level rate limiting on any endpoint at R1.**

**Why deferring is correct, not a shortcut** — the thing Redis would protect isn't publicly
reachable. Per `infra/Caddyfile`, the edge has site blocks for the **web** containers only; each
Spring API stays on its stack's `internal` network with no route in, so `/api/v1/**` has zero public
attack surface (BFF pattern, architecture §4/§5). Standing up a Redis container on the shared 4 GB
box before launch would add a service, a failure mode, and ~50–100 MB of the memory budget three
stacks already share, in exchange for guarding endpoints nobody outside the box can call.

**What actually guards the public surface at R1** (all of it Next.js server actions, not the API):
per-action honeypot + Bean-Validation-mirroring size caps in-app, Cloudflare WAF, and the **one**
free CF rate-limit rule — currently scoped to `/suggest-a-` (Block, 20/10s). Known gaps, accepted
for launch: the Brevo captures (digest / follow / host) and `/feedback` are **not** covered by that
rule, so a flood there burns Brevo send quota and sender reputation rather than the DB. Post-launch,
watch real traffic for a week before re-pointing the rule (see `cloudflare-ratelimit-repoint-at-r2`).

**Trigger to actually build this (R2):** accounts + login land. Login brute-force needs a shared
counter, and that's the first requirement a per-instance in-memory limiter can't honestly meet.
Then:
1. Add a **Redis** container to Compose (or a managed Redis).
2. Used for **cache + rate-limit counters only** — sessions and the job queue live in **Postgres**
   (architecture ADR 9/10), so Redis holds nothing durable and needs no persistence config.
3. Re-scope the CF rate-limit rule (or upgrade to Pro for more rules) now that app-level limiting
   covers the authenticated surface.
- **Outputs:** `REDIS_URL`.

## 11. Privacy analytics  *(R1-14 — code is DONE; this is the owner setup to switch it on)*
The code is wired and **inert until these env vars are set** (like Sentry). Analytics load on
**public pages only** (never `/admin`), are **cookieless**, honor **DNT/GPC**, and never build a
person profile — see `architecture.md` §10a / `apps/web/src/components/analytics/analytics.tsx`.

**Cloudflare Web Analytics** (free, cookieless) — **JS-snippet beacon token** (owner decision
2026-07-17; CF's *automatic* edge injection was tried but doesn't reliably fire on our streamed
Next.js SSR behind Caddy — verified the beacon never lands in the prod HTML — so the app injects it):
1. Cloudflare dashboard → **Web Analytics** → **Add a site** → **Enable with JS Snippet installation**
   → `beecompete.com`.
2. Copy the **beacon token** (the `token` value in the snippet — a hex string; do NOT paste the whole
   snippet, the app builds the tag) → `CF_WEB_ANALYTICS_TOKEN`.
   ⚠️ **Do NOT also enable CF "Automatic Setup"** — two beacons = **double-counted** pageviews.

**PostHog** (free tier — product analytics + feature flags + X20 zero-result search):
3. Create a PostHog account, choose the **EU** region (data residency; architecture §10).
4. Create **one** project — **shared by prod + local dev** (owner decision 2026-07-17) → copy the
   **Project API Key** (starts `phc_…`; write-only, safe in the browser).
5. In the project settings, turn **OFF**: **Session Replay**, **Autocapture**, **Dead clicks**
   autocapture, and **Web vitals / performance**. Our code disables all of these client-side too,
   but the dead-clicks script still *downloads* off the project's remote config unless you also flip
   it here — belt-and-suspenders for a minors' site.

**Wire it up** — set these in the **prod** stack env (`~/beecompete-prod/.env`), then recreate web
(`export IMAGE_TAG=…` first — see the `IMAGE_TAG` note in the "Known gaps / deferred" section, or
the owner's-manual §12 cheatsheet, for why a bare `up -d web` aborts):
```
POSTHOG_KEY=phc_xxx
POSTHOG_HOST=https://eu.i.posthog.com        # only if EU; US-host if you chose US
CF_WEB_ANALYTICS_TOKEN=xxxxxxxxxxxxxxxx
```
6. **Local dev:** the **same** PostHog key + CF token go in `apps/web/.env.local` (one shared PostHog
   project for prod + dev). **Staging:** leave both unset to keep staging out of the analytics.
7. **Verify:** load a public page → DevTools Network shows requests to `*.i.posthog.com` +
   `static.cloudflareinsights.com`; Application → Cookies shows **no** `ph_*` cookie; a `$pageview`
   lands in PostHog → **Activity**. (CF only *records* data for the real `beecompete.com` hostname,
   so its dashboard fills from prod traffic — but the beacon request fires locally so you can confirm
   it loads.)
- **Outputs:** `POSTHOG_KEY`, `CF_WEB_ANALYTICS_TOKEN` (+ optional `POSTHOG_HOST`) in the prod `.env`.

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
