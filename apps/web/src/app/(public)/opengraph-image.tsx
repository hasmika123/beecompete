import { ImageResponse } from 'next/og';

// Default OpenGraph/share card for public pages that don't have their own (R1-10). Rendered
// with next/og's bundled font (self-contained — no font CDN). Warm ground + gold brand accent,
// matching the design tokens. The competition detail route overrides this with a per-listing
// card.
export const runtime = 'nodejs';
export const alt = 'BeeCompete — find K-12 academic competitions';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GOLD = '#f5c330';
const INK = '#26251f';
const GROUND = '#faf9f5';
const MUTED = '#6c6a61';

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
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: GOLD,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '34px',
          }}
        >
          🐝
        </div>
        <div style={{ fontSize: '34px', fontWeight: 700, color: INK }}>BeeCompete</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '82px', fontWeight: 800, color: INK, lineHeight: 1.05 }}>
          Search. Compete.
        </div>
        <div style={{ fontSize: '82px', fontWeight: 800, color: GOLD, lineHeight: 1.05 }}>
          Participate.
        </div>
        <div style={{ marginTop: '28px', fontSize: '34px', color: MUTED, maxWidth: '900px' }}>
          Every K-12 academic competition — math, science, coding, debate, and more — in one curated
          place.
        </div>
      </div>

      <div style={{ height: '10px', width: '160px', borderRadius: '6px', background: GOLD }} />
    </div>,
    { ...size },
  );
}
