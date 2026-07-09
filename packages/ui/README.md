# @beecompete/ui

The shared design system (F7) — **the ONE home for shared UI**: tokens, primitives,
icons, fonts, logo. Consumed as source by `apps/web` via `transpilePackages`.

## Usage

```ts
// Components + icons (never import the icon lib or inline SVGs in app code):
import { Button, Card, Badge, Select, Input, Logo, ThemeToggle, Search } from '@beecompete/ui';
```

```css
/* Tokens — once, in the app's Tailwind entry (apps/web globals.css): */
@import '@beecompete/ui/styles/tokens.css';
@source '../../../../packages/ui/src'; /* let Tailwind scan ui sources */
```

## What lives where

- `src/styles/tokens.css` — **all styling decisions**: semantic color tokens (light + `.dark`),
  the two-font system, radii (`--radius-field` 12px / `--radius-panel` 16px), shadows,
  `@font-face` for the self-hosted fonts, and the Tailwind `@theme` mapping.
- `src/fonts/` — **self-hosted** woff2 (no font CDN — privacy/CSP): Fraunces variable
  (display headlines, ~560 weight — titles never thin; italic accents sparingly) + Inter
  Variable (body/UI), latin subsets, OFL licenses alongside.
- `src/components/` — Button (pill; primary/brand/secondary/ghost), Input/Textarea,
  Select (accessible custom listbox — styleable rounded panel), Card, Badge, Logo
  (placeholder wordmark), ThemeToggle.
- `src/icons.ts` — curated Phosphor re-exports (regular default; bold/fill/duotone
  weights per use); add icons here as features need them.

## Rules (design-brief §3/§4)

- **Search here before creating any shared component.** No duplicates; never inline SVGs.
- Gold `#F5C330` is **fill/accent only** — never text on white; text on gold is always ink.
- **No harsh `#000` blacks** — warm charcoals on a warm paper ground; dark mode is a warm
  Claude-style dark gray (`#262624`), never black.
- Pill buttons; panels ≥12–16px radius; hairline borders; **no glow/colored shadows**
  (the `interactive` Card lift is the one sanctioned shadow).
- Both themes come from the tokens — components never hardcode colors.
- WCAG 2.1 AA: ink focus rings (gold fails 3:1), `aria-invalid` states, labeled controls.

Live showcase: `/design` in apps/web. Tests: `pnpm --filter @beecompete/ui test` (Vitest).
