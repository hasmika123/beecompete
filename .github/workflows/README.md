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

> **Still skeleton:** **F6** adds `deploy-staging.yml` (push to `main` → staging) and
> `deploy-prod.yml` (release tag `R*` / manual dispatch → prod) with the Liquibase
> migration step, health checks, and rollback.

See [`docs/development-process.md`](../../docs/development-process.md) §5 and
[`docs/architecture.md`](../../docs/architecture.md) §14.
