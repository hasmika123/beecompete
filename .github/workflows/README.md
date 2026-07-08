# .github/workflows

CI/CD pipelines (GitHub Actions).

> **Skeleton only.** Workflows land in later foundation tasks:
>
> - **F5** — `ci.yml`: web + API tests, lint, dependency/secret/SAST scans, path
>   filters, caching. Runs on every PR/push; **no deploy**. All green required to merge.
> - **F6** — `deploy-staging.yml` (push to `main` → staging) and `deploy-prod.yml`
>   (release tag `R*` or manual dispatch → prod). Liquibase migration + health checks +
>   rollback.
>
> See [`docs/development-process.md`](../../docs/development-process.md) §5 and
> [`docs/architecture.md`](../../docs/architecture.md) §14.
