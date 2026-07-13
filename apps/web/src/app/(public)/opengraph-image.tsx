import { ImageResponse } from 'next/og';
import { BrandRow, GOLD, GROUND, INK, MUTED, OG_FONTS, OG_SIZE } from '@/lib/og';

// Default OpenGraph/share card for public pages that don't have their own (R1-10). Fully
// self-contained (inline SVG brand mark + self-hosted TTF fonts, no CDN), in the brand faces —
// Fraunces display headlines, Inter for UI text. The competition detail route overrides this
// with a per-listing card.
export const runtime = 'nodejs';
export const alt = 'BeeCompete — find K-12 academic competitions';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: GROUND,
        padding: '72px',
        fontFamily: 'Inter',
      }}
    >
      <BrandRow badge={56} font={34} />

      <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Fraunces' }}>
        <div style={{ fontSize: '82px', fontWeight: 700, color: INK, lineHeight: 1.05 }}>
          Search. Compete.
        </div>
        <div style={{ fontSize: '82px', fontWeight: 700, color: GOLD, lineHeight: 1.05 }}>
          Participate.
        </div>
        <div
          style={{
            fontFamily: 'Inter',
            marginTop: '28px',
            fontSize: '34px',
            fontWeight: 500,
            color: MUTED,
            maxWidth: '900px',
          }}
        >
          Every K-12 academic competition — math, science, coding, debate, and more — in one curated
          place.
        </div>
      </div>

      <div style={{ height: '10px', width: '160px', borderRadius: '6px', background: GOLD }} />
    </div>,
    { ...size, fonts: OG_FONTS },
  );
}
