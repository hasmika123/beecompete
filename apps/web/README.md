# @beecompete/web

The Next.js web app **and BFF** — it forwards the httpOnly session cookie to the Spring
API (the session ID never touches client JS; architecture §4/§5). The BFF/session
plumbing lands with auth in R2 — none exists yet.

> **F3 skeleton (done).** App Router + TypeScript, Tailwind v4, `@beecompete/ui` and
> `@beecompete/config` wired via `transpilePackages`, an app shell (header/footer) and
> **light/dark theming** via `next-themes` + design-token CSS variables, plus a
> placeholder logo/icon. Real pages and the design system land later — see
> [`docs/phase-1-plan.md`](../../docs/phase-1-plan.md).

## Layout

- `src/app/` — App Router (root `layout.tsx` = app shell; `page.tsx` = placeholder home).
- `src/app/globals.css` — Tailwind v4 entry + the **theming mechanism** (CSS variables +
  `.dark` class). **Placeholder tokens only — F7 replaces them** with the real design
  system from `packages/ui`.
- `src/components/` — local skeleton components. `theme-toggle.tsx` and `logo.tsx` are
  **`TODO(F7)` placeholders** — they migrate into `@beecompete/ui` once primitives exist.

## Conventions

- **All shared UI comes from `@beecompete/ui`** — search there before creating anything.
  (The two `TODO(F7)` placeholders above are the only sanctioned pre-F7 exception.)
- Mobile-first, fully responsive; WCAG 2.1 AA on new UI; light + dark via tokens.
- **No font CDN** (privacy + CSP) — fonts are self-hosted in `packages/ui` at F7
  (display serif for headlines + Inter for body/UI, design-brief §3); the skeleton uses a
  system font stack.
- Client validation mirrors server rules for UX only — the server is the real gate.
- SSG/ISR for public marketplace pages (SEO); client/SSR for authed dashboards.

## Scripts

`pnpm --filter @beecompete/web <dev|build|start|lint|typecheck>` — or run via Turbo from
the repo root (`pnpm dev|build|lint|typecheck`).
