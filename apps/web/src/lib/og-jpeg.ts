import type { ImageResponse } from 'next/og';
import sharp from 'sharp';

// Re-encodes a next/og card as JPEG (2026-09-19).
//
// Why: next/og can only emit PNG, and PNG is a terrible container for a photograph. The
// per-competition card carries cover art in its right half, which put the live images at
// 736-965KB (median ~800KB, measured across 12 listings in prod). Two things broke:
//
//   * WhatsApp drops an og:image over roughly 600KB, so competition links previewed with no
//     image at all while the text-only homepage card (60KB) worked fine.
//   * Every scraper fetch pulled ~1MB from the origin box in US East, ~1-1.5s a time.
//
// The same card as JPEG is ~85KB with no visible difference. PNG stays the right format for the
// text-only cards — flat colour compresses better losslessly and the type edges stay perfectly
// sharp — so this is only for routes whose card can carry cover art.

/** 4:4:4 rather than the usual 4:2:0: the card's left half is type, including the accent-coloured
 *  category label, and chroma subsampling is exactly what fringes coloured edges. The extra bytes
 *  (~83KB vs ~66KB on a sampled card) are noise next to the 856KB we started from. */
const JPEG_OPTIONS = { quality: 85, mozjpeg: true, chromaSubsampling: '4:4:4' } as const;

/** Mirrors the listing page's own `revalidate = 3600`, so a scraper can't hold a share card longer
 *  than the page it describes. NOTE: Cloudflare will not cache an extensionless URL on this header
 *  alone — it needs a Cache Rule. See setup-runbook.md, "OG share images". */
export const OG_CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';

/** Render an ImageResponse and hand back the same card as JPEG. */
export async function toJpegResponse(image: ImageResponse): Promise<Response> {
  const png = Buffer.from(await image.arrayBuffer());
  const jpeg = await sharp(png).jpeg(JPEG_OPTIONS).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': OG_CACHE_CONTROL },
  });
}
