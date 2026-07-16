import { frauncesDisplay } from '@/lib/fonts/fraunces-display';
import { interText } from '@/lib/fonts/inter-text';
import { OG_WORDMARK } from '@/lib/og-wordmark';

// Shared bits for the next/og share-card routes (R1-10). The brand lockup is the official
// wordmark, embedded as a base64 PNG data URI (see og-wordmark.ts) — next/og renders in a
// standalone context and can't fetch app assets (or twemoji) at render time, so everything the
// card needs is inlined and the route depends on no outbound network.
//
// Fonts (review L12): the cards render in the BRAND faces, not next/og's bundled Geist — Fraunces
// for display headlines, Inter for UI text (design-brief typography lock). satori
// can't consume our variable woff2s, so these are static TTF instances (Fraunces 700 @ opsz 144,
// Inter 500 @ opsz 16) derived from the same OFL fonts, embedded as base64 (see the .ts files) so
// they need no fs/tracing in the standalone image.

export const OG_FONTS = [
  { name: 'Fraunces', data: frauncesDisplay, weight: 700 as const, style: 'normal' as const },
  { name: 'Inter', data: interText, weight: 500 as const, style: 'normal' as const },
];

export const OG_SIZE = { width: 1200, height: 630 };

export const GOLD = '#f5c330';
export const INK = '#26251f';
export const GROUND = '#faf9f5';
export const MUTED = '#6c6a61';

// Wordmark intrinsic size (apps/web/public/brand/logo-light.png) → aspect ratio for width calc.
const WORDMARK_W = 821;
const WORDMARK_H = 150;

/** Brand lockup: the official wordmark logo at the given height (light-mode art on the light card). */
export function BrandRow({ height = 48 }: { height?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/og (satori) renders a plain <img>; next/image can't run in an ImageResponse
    <img
      src={OG_WORDMARK}
      alt="BeeCompete"
      height={height}
      width={Math.round((height * WORDMARK_W) / WORDMARK_H)}
      style={{ display: 'block' }}
    />
  );
}
