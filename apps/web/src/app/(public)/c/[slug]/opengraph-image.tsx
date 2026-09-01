import { ImageResponse } from 'next/og';
import { categoryHue } from '@beecompete/ui';
import { fetchCompetition } from '@/lib/catalog-api';
import { eligibilityLabel } from '@/lib/catalog-display';
import { PublicApiError } from '@/lib/public-api';
import { BrandRow, GOLD, GROUND, INK, MUTED, OG_FONTS, OG_SIZE } from '@/lib/og';

// Per-competition OpenGraph/share card (R1-10; cover art per owner 2026-09-01). Brand chrome
// (fonts, wordmark) stays inlined, and when the competition has cover art the card's right half
// carries it — fetched server-side and embedded as a data URI, BEST-EFFORT: any miss (no cover,
// slow S3, non-raster type) falls back to the text-only brand card, so a share link never
// renders a broken image.
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';

// Right-hand cover panel width; the text column keeps the remaining ~640px.
const COVER_W = 540;

// satori rasterizes jpeg/png/gif but THROWS on webp/avif/svg — and a render-time throw is a
// broken share image, so the type gate is a whitelist, not image/*.
const COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif']);

/** Fetch cover art into a data URI (satori can't stream remote images safely). Undefined on any miss. */
async function fetchCoverDataUri(url: string): Promise<string | undefined> {
  try {
    // 4s cap: a hung S3 read must not stall the card past a link scraper's patience — the
    // text-only card is the better outcome.
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = (res.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
    if (!res.ok || !COVER_TYPES.has(type)) return undefined;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > 8 * 1024 * 1024) return undefined;
    return `data:${type};base64,${Buffer.from(buf).toString('base64')}`;
  } catch {
    return undefined;
  }
}

// Dynamic alt text carrying the competition name (a11y). Separate invocation from Image(), but
// the fetch is revalidate-cached so it's a cache hit, not a second round-trip.
export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let alt = 'Competition on BeeCompete';
  try {
    const c = await fetchCompetition(slug);
    alt = `${c.name} on BeeCompete`;
  } catch {
    // keep the generic alt
  }
  return [{ id: 'og', size: OG_SIZE, contentType: 'image/png', alt }];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let name = 'Academic Competitions';
  let categoryName = '';
  let accent = GOLD;
  let facts: string[] = [];
  let cover: string | undefined;

  try {
    const c = await fetchCompetition(slug);
    name = c.name;
    categoryName = c.category.name;
    accent = categoryHue(c.category.slug);
    if (c.logo) cover = await fetchCoverDataUri(c.logo);
    // The stated axis, same rule as the card and the strip
    // (blueprints decision 99). A share card is the most
    // context-free surface we have — it travels with no page around it — so an unrecorded
    // eligibility drops out of the fact row entirely rather than reading "All grades".
    const eligibility = eligibilityLabel(c);
    facts = [
      ...(eligibility ? [eligibility] : []),
      c.costType === 'free' ? 'Free to enter' : 'Paid',
    ];
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
          // The cover panel narrows the text column, so pull the padding in with it.
          padding: cover ? '56px' : '64px',
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
              // A size down when the cover halves the column, so long names still fit 3 lines.
              fontSize: cover
                ? name.length > 40
                  ? '52px'
                  : '64px'
                : name.length > 40
                  ? '64px'
                  : '80px',
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
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- satori renders a plain <img>
        <img
          src={cover}
          alt=""
          width={COVER_W}
          height={OG_SIZE.height}
          style={{ width: `${COVER_W}px`, height: '100%', objectFit: 'cover' }}
        />
      ) : null}
    </div>,
    { ...size, fonts: OG_FONTS },
  );
}
