# @beecompete/ui

The **single home for shared UI** — design tokens, primitives, icons, and logo/font
assets. Consumed **as source** by `apps/web` via Next's `transpilePackages`.

> **Skeleton only.** The real design system is built in **F7** (see
> [`docs/phase-1-plan.md`](../../docs/phase-1-plan.md) and
> [`docs/design-brief.md`](../../docs/design-brief.md)).

## Rules (also in root `CLAUDE.md`)

- **Search here before creating any shared component.** No duplicates.
- **Never inline SVGs or hand-roll styles** for shared things — they live here.
- Palette: gold `#F5C330` + ink `#030201`. Typeface: **Inter**, self-hosted (no font CDN).
- Buttons: flat gold fill + near-black text, ~12px radius, **no glow/colored shadows**.
- Light + dark via tokens; WCAG 2.1 AA; mobile-first.
