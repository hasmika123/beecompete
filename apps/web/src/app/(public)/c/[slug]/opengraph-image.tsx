import { ImageResponse } from 'next/og';
import { categoryHue } from '@beecompete/ui';
import { fetchCompetition } from '@/lib/catalog-api';
import { gradeLabel } from '@/lib/catalog-display';
import { PublicApiError } from '@/lib/public-api';
import { BrandRow, GOLD, GROUND, INK, MUTED, OG_FONTS, OG_SIZE } from '@/lib/og';

// Per-competition OpenGraph/share card (R1-10). Fully self-contained — next/og's bundled font
// plus an inline SVG brand mark (no emoji → no runtime twemoji CDN fetch): category-accent bar
// + name + grade/cost facts + brand footer. Falls back to a brand card if the slug is missing
// so a share link never renders a broken image.
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';

// Dynamic alt text carrying the competition name (a11y). Separate invocation from Image(), but
// the fetch is revalidate-cached so it's a cache hit, not a second round-trip.
export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let alt = 'Competition on BeeCompete';
  try {
    const c = await fetchCompetition(slug);
    alt = `${c.name} — on BeeCompete`;
  } catch {
    // keep the generic alt
  }
  return [{ id: 'og', size: OG_SIZE, contentType: 'image/png', alt }];
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
    accent = categoryHue(c.category.slug);
    const grades = gradeLabel(c.minGrade, c.maxGrade);
    facts = [grades ?? 'All grades', c.costType === 'free' ? 'Free to enter' : 'Paid'];
  } catch (e) {
    if (!(e instanceof PublicApiError && e.status === 404)) throw e;
    // 404 → the generic brand card (name/facts stay at their defaults).
  }

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        background: GROUND,
        fontFamily: 'Inter',
      }}
    >
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
        <BrandRow />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {categoryName ? (
            <div
              style={{
                fontSize: '30px',
                fontWeight: 500,
                color: accent,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              {categoryName}
            </div>
          ) : null}
          {/* lineClamp truncates long names with an ellipsis so they can't push the fact row
                off the 630px canvas (names allow up to 300 chars). */}
          <div
            style={{
              fontFamily: 'Fraunces',
              marginTop: '18px',
              fontSize: name.length > 40 ? '64px' : '80px',
              fontWeight: 700,
              color: INK,
              lineHeight: 1.05,
              lineClamp: 3,
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
                fontWeight: 500,
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
    { ...size, fonts: OG_FONTS },
  );
}
