import { ImageResponse } from 'next/og';
import { fetchCompetition } from '@/lib/catalog-api';
import { gradeLabel } from '@/lib/catalog-display';
import { PublicApiError } from '@/lib/public-api';

// Per-competition OpenGraph/share card (R1-10). Self-contained (next/og bundled font, no CDN):
// category-accent bar + name + grade/cost facts + brand footer. Falls back to a brand card if
// the slug is missing so a share link never renders a broken image.
export const runtime = 'nodejs';
export const alt = 'Competition on BeeCompete';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GOLD = '#f5c330';
const INK = '#26251f';
const GROUND = '#faf9f5';
const MUTED = '#6c6a61';

// Category accent (the ~600 tone of each category's hue in packages/ui category-art).
const ACCENT: Record<string, string> = {
  math: '#2563eb',
  'science-engineering': '#059669',
  'computer-science': '#7c3aed',
  robotics: '#ea580c',
  'debate-speech': '#e11d48',
  'business-entrepreneurship': '#0d9488',
  'writing-essay': '#4f46e5',
  'arts-music': '#c026d3',
  'academic-bowl': '#d97706',
  'history-geography-civics': '#0284c7',
  other: '#78716c',
};

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: GOLD,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
        }}
      >
        🐝
      </div>
      <div style={{ fontSize: '30px', fontWeight: 700, color: INK }}>BeeCompete</div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let name = 'K-12 Academic Competitions';
  let categoryName = '';
  let accent = GOLD;
  let facts: string[] = [];

  try {
    const c = await fetchCompetition(slug);
    name = c.name;
    categoryName = c.category.name;
    accent = ACCENT[c.category.slug] ?? GOLD;
    const grades = gradeLabel(c.minGrade, c.maxGrade);
    facts = [grades ?? 'All grades', c.costType === 'free' ? 'Free to enter' : 'Paid'];
  } catch (e) {
    if (!(e instanceof PublicApiError && e.status === 404)) throw e;
    // 404 → the generic brand card (name/facts stay at their defaults).
  }

  return new ImageResponse(
    <div style={{ height: '100%', width: '100%', display: 'flex', background: GROUND }}>
      <div style={{ width: '18px', height: '100%', background: accent }} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
        }}
      >
        <Brand />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {categoryName ? (
            <div
              style={{
                fontSize: '30px',
                fontWeight: 700,
                color: accent,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              {categoryName}
            </div>
          ) : null}
          <div
            style={{
              marginTop: '18px',
              fontSize: name.length > 40 ? '64px' : '80px',
              fontWeight: 800,
              color: INK,
              lineHeight: 1.05,
              display: 'flex',
            }}
          >
            {name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {facts.map((f) => (
            <div
              key={f}
              style={{
                fontSize: '28px',
                color: MUTED,
                border: `2px solid ${MUTED}33`,
                borderRadius: '999px',
                padding: '8px 24px',
                display: 'flex',
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
