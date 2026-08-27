'use client';

import { useState } from 'react';

// The art inside a prep-resource card's art box (resources-row.tsx owns the box; see the long
// comment there for the frame-not-crop rules). Client component for ONE reason: the onError
// failsafe. `imageUrl` is curator-entered and points at third-party hosts as often as our S3
// bucket, so a dead link is a matter of time — when the real art 404s (or the resource never had
// any), the card falls back to the generic per-type art in /resource-art/*.svg instead of the
// broken-image glyph. The failsafe is one-way per mount: once real art fails we stay on the
// generic (no retry loop on a permanently dead URL).
//
// Plain <img>, not next/image — the optimizer needs sharp at runtime, which the standalone
// runner does not carry (same call as landing/hero-image). alt="" on purpose: the title below
// is the link's accessible name, so alt text here would make a screen reader announce the same
// resource twice — and the generic art is decoration by definition.
//
// max-h/max-w + object-contain, NOT size-full/cover: the drawn box hugs the art, so the
// rounded-md corners land on the image itself, small thumbnails render at natural size instead
// of blowing up, and nothing gets cropped to the box's square.
export function ResourceArt({
  imageUrl,
  fallbackSrc,
}: {
  imageUrl: string | null;
  fallbackSrc: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = !failed && imageUrl ? imageUrl : fallbackSrc;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/image needs sharp at runtime, which the standalone runner does not carry (same call as landing/hero-image)
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="max-h-full max-w-full rounded-md object-contain"
    />
  );
}
