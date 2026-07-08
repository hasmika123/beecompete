# @beecompete/web

The Next.js web app **and BFF** — it forwards the httpOnly session cookie to the Spring
API (the session ID never touches client JS; architecture §4/§5).

> **Skeleton only.** The real Next.js app (App Router, TypeScript, Tailwind v4,
> `@beecompete/ui` wired via `transpilePackages`, app shell + light/dark theming +
> placeholder logo) is scaffolded in **F3**. See
> [`docs/phase-1-plan.md`](../../docs/phase-1-plan.md).

## Conventions

- **All shared UI comes from `@beecompete/ui`** — search there before creating anything.
- Mobile-first, fully responsive; WCAG 2.1 AA on new UI; light + dark via tokens.
- Client validation mirrors server rules for UX only — the server is the real gate.
- SSG/ISR for public marketplace pages (SEO); client/SSR for authed dashboards.
