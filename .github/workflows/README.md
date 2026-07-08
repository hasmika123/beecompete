# .github/workflows

CI/CD pipelines (GitHub Actions).

## `ci.yml` (F5)

Runs on every PR + push to `main`; **no deploy**. Jobs:

- **web** — pnpm `format:check` + `lint` + `typecheck` + `build` (path-filtered to JS/doc changes).
- **api** — `./gradlew build` incl. the Testcontainers integration test (path-filtered to `apps/api`).
- **security** — gitleaks secret scan (**blocking**); Semgrep SAST + Trivy dependency scan (**advisory** for now — they report without blocking merges; flip to blocking once a triage process exists).
- **ci-status** — one consolidated pass/fail; point branch protection at it.

Kept cheap: `dorny/paths-filter` skips unchanged trees, pnpm/Gradle caching, and
`cancel-in-progress` concurrency.

**Constraints (private repo, Free plan):** CodeQL / dependency-review need GitHub Advanced
Security, so we use Semgrep + Trivy + gitleaks instead. Required-status-check enforcement
(branch protection) needs the repo to be public or on Pro — CI still runs and reports today.

## `deploy-staging.yml` + `deploy-prod.yml` (F6)

**Build once, promote.** A merge to `main` triggers `deploy-staging.yml`: it builds the web
+ api images (`:sha` + `:staging`), pushes to GHCR, then SSHes to the VPS to refresh the
staging Compose stack and waits for `/actuator/health` = UP. A release tag
(`git tag R1 && git push origin R1`) triggers `deploy-prod.yml`: it **re-tags the exact
`:sha` image staging validated** (no rebuild) and refreshes the prod stack. Liquibase
migrates on API startup (DIRECT_URL). Both use GitHub **Environments** (`staging`,
`production`) for their secrets.

**Requires (one-time, see [`docs/setup-runbook.md`](../../docs/setup-runbook.md) §8):**
repo secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `GHCR_TOKEN`; the `staging`/`production`
Environments; and a per-env `.env` on the VPS (`SITE_ADDRESS`, `DATABASE_URL`, `DIRECT_URL`,
…). These workflows can't run until that infra exists.

See [`docs/development-process.md`](../../docs/development-process.md) §5 and
[`docs/architecture.md`](../../docs/architecture.md) §14.
