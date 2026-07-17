# BeeCompete — External Setup Runbook

**Status:** Living document · **Last updated:** 2026-07-12 · **Type:** Runbook

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
  cache so cached noindex HTML can't linger). Then: verify `beecompete.com/robots.txt` + a
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
- ~~Web-side Sentry not wired.~~ **Code wired 2026-07-12** (Dockerfile build-arg + deploy-staging
  build-args for the browser side; `WEB_SENTRY_DSN` env on the web services for the Node/SSR side;
  environment inferred from hostname since one image serves both envs). **Two manual steps remain
  before it captures anything:** (1) add the web project's DSN as GitHub secret **`WEB_SENTRY_DSN`**
  (repo-level or in both environments), (2) add `WEB_SENTRY_DSN=<same DSN>` to both VPS `.env` files
  (`~/beecompete-staging/.env`, `~/beecompete-prod/.env`). Blank = builds fine, Sentry stays inert.
- ~~On 4 GB, cap the API JVM heap in the stack env so it can't balloon.~~ **Done 2026-07-12:**
  every service in the deploy stacks now has a `mem_limit` (staging api 768m/web 384m; prod api
  1g/web 512m; edge caddy 192m), the API JVM gets `-XX:MaxRAMPercentage=75.0` so the heap sizes
  off the container limit, and all services have json-file log rotation (10m × 3). Takes effect
  per-stack on its next deploy; the edge stack needs a manual
  `docker compose -f docker-compose.edge.yml up -d` on the box.
- **Security:** rotate the Neon **prod** DB password (it briefly sat in a plaintext local file); keep the
  secrets sheet in a password manager, never in Downloads/repo.
- Remaining before-launch items are in §s above + the checklist below (Neon paid tier/test restore/
  autosuspend-off; repo→private + Pro + required reviewer + `protect-main`; UptimeRobot on
  `/actuator/health`; confirm Sentry `sendDefaultPii:false` + Session Replay off + test errors; Brevo
  end-to-end consent-email test; AWS root MFA + no root keys; Cloudflare Access lock + robots/noindex on
  staging).

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
1. Create a **Neon** project (free tier) → get the connection string.
2. Create separate databases/branches for **staging** and **production**.
3. Before real users: upgrade to a **paid tier** with automated backups + **PITR**; run one **test restore**.
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
2. **Lists:** Brevo → **Contacts → Lists** → create up to three (e.g. "Weekly digest", "Competition
   follows", "Host waitlist") → copy each numeric id → `BREVO_DIGEST_LIST_ID`,
   `BREVO_FOLLOW_LIST_ID`, `BREVO_HOST_LIST_ID`.
3. **Contact attributes:** Brevo → **Contacts → Settings → Contact attributes** → create text
   attributes **`GRADE`, `INTEREST`, `STATE`** (digest preferences) and **`COMPETITION`** (which
   listing a follow/host visitor acted on). Brevo rejects contacts with undefined attributes, so
   create the ones your enabled captures use.
4. **Double opt-in (recommended):** create one transactional **"confirm your subscription" template**
   (Brevo → Campaigns → Templates) → copy its id → `BREVO_DOI_TEMPLATE_ID` (shared across all three
   captures); optionally set `BREVO_DOI_REDIRECT_URL` (post-confirm landing). Without it, single
   opt-in. *(`BREVO_DIGEST_DOI_TEMPLATE_ID` still works as an alias for a digest-only setup.)*
5. **Set them in `~/beecompete-prod/.env`** and recreate web (the compose passes them through):
   `BREVO_API_KEY`, `BREVO_DIGEST_LIST_ID`, `BREVO_FOLLOW_LIST_ID`, `BREVO_HOST_LIST_ID`,
   `BREVO_DOI_TEMPLATE_ID`, `BREVO_DOI_REDIRECT_URL`.
6. **Verify:** submit the Landing digest band + a detail page's **Follow** + **Claim** → each shows
   the confirm message → contacts land in the right list (after confirming) with their attributes.
- **Outputs:** `BREVO_API_KEY` + the list ids you enabled (+ shared DOI template) in the prod `.env`.
- **Note:** R1 ships **capture + segmentation only** — the weekly send is manual/curated in Brevo
  (automated matching send = **M26, Phase 2**); email-followers convert to accounts at **R2-16**.
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
3. **Uptime monitor** (UptimeRobot/BetterStack free) → poll `https://<domain>/actuator/health`
   (expects `{"status":"UP"}`); alert to email.
- **Outputs:** DSNs live in each env; Sentry receiving events; uptime alerts on; JSON logs aggregating.

## 10. Redis  *(R2; R1 if rate-limiting early)*
1. Add a **Redis** container to Compose (or a managed Redis).
2. Used for **cache + rate-limit counters only** — sessions and the job queue live in **Postgres** (architecture ADR 9/10), so Redis holds nothing durable and needs no persistence config.
- **Outputs:** `REDIS_URL`.

## 11. Privacy analytics  *(R1-14 — code is DONE; this is the owner setup to switch it on)*
The code is wired and **inert until these env vars are set** (like Sentry). Analytics load on
**public pages only** (never `/admin`), are **cookieless**, honor **DNT/GPC**, and never build a
person profile — see `architecture.md` §10a / `apps/web/src/components/analytics/analytics.tsx`.

**Cloudflare Web Analytics** (free, cookieless) — **AUTOMATIC edge injection** (owner decision
2026-07-17; no token, no code, since the site is proxied through Cloudflare):
1. Cloudflare dashboard → **Web Analytics** → **Add a site** → enable **Automatic Setup** → choose
   `beecompete.com`. CF injects the beacon at the edge. Leave `CF_WEB_ANALYTICS_TOKEN` **blank**.
   ⚠️ **Never also set the token** while automatic is on — that injects a second beacon and
   **double-counts** pageviews.
2. **Exclude staging:** CF matches hostnames by *postfix*, so a `beecompete.com` site also captures
   `staging.beecompete.com` by default. To keep staging out, open the site → **Rules → Add rule →
   Exclude** → hostname `staging.beecompete.com`.

**PostHog** (free tier — product analytics + feature flags + X20 zero-result search):
3. Create a PostHog account, choose the **EU** region (data residency; architecture §10).
4. Create **one** project — **shared by prod + local dev** (owner decision 2026-07-17) → copy the
   **Project API Key** (starts `phc_…`; write-only, safe in the browser).
5. In the project settings, confirm **Session Replay is OFF** and **Autocapture is OFF** (our code
   already disables both client-side, but belt-and-suspenders for a minors' site).

**Wire it up** — set these in the **prod** stack env (`~/beecompete-prod/.env`), then
`docker compose -f docker-compose.prod.yml up -d web` (CF needs nothing here — it's automatic):
```
POSTHOG_KEY=phc_xxx
POSTHOG_HOST=https://eu.i.posthog.com        # only if EU; US-host if you chose US
# CF_WEB_ANALYTICS_TOKEN stays UNSET — automatic edge injection
```
6. **Local dev:** the **same** PostHog key goes in `apps/web/.env.local` (shared project). **Staging:**
   leave `POSTHOG_KEY` unset (or it joins the shared project); CF staging is handled by the rule above.
7. **Verify — PostHog (local + prod):** load a public page → DevTools Network shows a request to
   `*.i.posthog.com`; Application → Cookies shows **no** `ph_*` cookie; a `$pageview` lands in
   PostHog → **Activity**. **Verify — CF (prod only):** automatic injection doesn't touch localhost,
   so open `https://beecompete.com` in prod → DevTools Network shows `static.cloudflareinsights.com`
   (beacon) + a `cloudflareinsights.com/cdn-cgi/rum` POST; data shows in the CF dashboard within
   a few minutes.
- **Outputs:** `POSTHOG_KEY` (+ optional `POSTHOG_HOST`) in the prod `.env`; CF automatic enabled
  (no env var).

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
