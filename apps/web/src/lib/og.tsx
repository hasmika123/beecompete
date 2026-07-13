import { frauncesDisplay } from '@/lib/fonts/fraunces-display';
import { interText } from '@/lib/fonts/inter-text';

// Shared bits for the next/og share-card routes (R1-10). The brand mark is an inline SVG
// honeycomb hexagon — NOT an emoji: next/og resolves emoji by fetching twemoji SVGs from a CDN
// at render time (the bundled Geist font has no emoji glyphs), which would make the OG route
// depend on outbound network at runtime. Inline SVG keeps the cards genuinely self-contained.
//
// Fonts (review L12): the cards render in the BRAND faces, not next/og's bundled Geist — Fraunces
// for display headlines + the wordmark, Inter for UI text (design-brief typography lock). satori
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

/** Gold rounded badge with an ink honeycomb hexagon — the emoji-free brand mark. */
export function BeeHex({ badge = 44 }: { badge?: number }) {
  const hex = Math.round(badge * 0.58);
  return (
    <div
      style={{
        width: badge,
        height: badge,
        borderRadius: Math.round(badge * 0.27),
        background: GOLD,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={hex} height={hex} viewBox="0 0 24 24">
        <polygon points="12,2.5 20.4,7.25 20.4,16.75 12,21.5 3.6,16.75 3.6,7.25" fill={INK} />
      </svg>
    </div>
  );
}

/** Brand row: hex badge + "BeeCompete" wordmark (Fraunces, matching the site logo). */
export function BrandRow({ badge = 44, font = 30 }: { badge?: number; font?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(badge * 0.32) }}>
      <BeeHex badge={badge} />
      <div style={{ fontFamily: 'Fraunces', fontSize: font, fontWeight: 700, color: INK }}>
        BeeCompete
      </div>
    </div>
  );
}
