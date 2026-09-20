// Generates the app-dir icon set from the canonical brand mark.
//
//   pnpm node scripts/generate-app-icons.mjs
//
// Why this exists: Google only shows a favicon in search results when it can fetch a SQUARE icon
// (ideally a multiple of 48px) and, failing the <link>, /favicon.ico. The brand mark is 171x150 and
// the hand-written icon.svg inherited that non-square box, so there was nothing square to serve and
// /favicon.ico 404'd. Everything below is derived from apps/web/public/brand/mark-light.png so the
// mark stays the single source of truth — re-run this after the mark changes, never hand-edit the
// outputs.
//
// The look (owner, 2026-09-19): transparent corners, full-bleed white circle, colour bee centred on
// it. The white disc is what makes the mark legible on a dark browser tab strip, where the old
// white-line mark-dark.png all but vanished.

import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** sharp is a transitive dependency (Next.js pulls it in), so it isn't hoisted to a top-level
 *  node_modules/. Try the normal resolution first, then the pnpm store, and only then give up with
 *  something actionable — this script runs by hand, not in CI, so an explicit install is fine. */
async function loadSharp() {
  const stores = [
    path.join(repoRoot, 'apps/web/node_modules'),
    path.join(repoRoot, 'node_modules'),
  ];
  try {
    return require(require.resolve('sharp', { paths: stores }));
  } catch {
    /* fall through to the pnpm store */
  }

  const pnpmDir = path.join(repoRoot, 'node_modules/.pnpm');
  const entries = await readdir(pnpmDir).catch(() => []);
  const match = entries.find((entry) => entry.startsWith('sharp@'));
  if (match) return require(path.join(pnpmDir, match, 'node_modules/sharp'));

  throw new Error('sharp not found — run `pnpm add -Dw sharp`, then re-run this script.');
}

const sharp = await loadSharp();

const MARK = path.join(repoRoot, 'apps/web/public/brand/mark-light.png');
const APP_DIR = path.join(repoRoot, 'apps/web/src/app');

/** Largest square we ship. Google only asks for a square that's a multiple of 48px, and the brand
 *  mark is 163x135 of raster art (architecture.md §8) — rendering a 512 master would just ship an
 *  upscaled blur. At 192 (4x48, and the standard Android/PWA size) the bee lands at 154px, a slight
 *  DOWNSCALE of the source, so every output below is crisp. */
const MASTER = 192;
/** Bee width as a fraction of the canvas. At 0.8 the widest points (wing tips, antenna dots) still
 *  clear the disc's edge, and the mark carries enough weight to read at 16-32px. Bigger (0.88+) and
 *  the wing tips crowd the edge; smaller (0.72) and the bee floats in too much white. */
const BEE_SCALE = 0.8;
/** ICO bundles the three sizes Windows, Chrome and Google's favicon fetcher actually ask for. */
const ICO_SIZES = [16, 32, 48];
/** iOS home-screen icon. Opaque on purpose — see makeAppleIcon(). */
const APPLE = 180;

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** The mark padded with empty pixels; trim so the geometry below is measured off the real artwork. */
async function trimmedMark() {
  const buffer = await sharp(MARK).trim({ threshold: 1 }).png().toBuffer();
  const { width, height } = await sharp(buffer).metadata();
  return { buffer, width, height };
}

/** The bee, resized to BEE_SCALE of `size`, plus the offsets that centre it on the canvas. */
async function beeLayer(mark, size) {
  const width = Math.round(size * BEE_SCALE);
  const height = Math.round((width * mark.height) / mark.width);
  const input = await sharp(mark.buffer).resize(width, height).png().toBuffer();
  return { input, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) };
}

/** Transparent square + full-bleed white disc + bee. The shape every surface but iOS gets. */
async function makeDisc(mark, size) {
  const circle = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/></svg>`,
  );
  return sharp({ create: { width: size, height: size, channels: 4, background: TRANSPARENT } })
    .composite([{ input: circle }, await beeLayer(mark, size)])
    .png()
    .toBuffer();
}

/** iOS composites a transparent touch icon onto BLACK before applying its own rounded-rect mask, so
 *  a transparent-cornered disc would ship a black tile. Fill the square white instead — once masked
 *  it reads as the same white-disc mark. */
async function makeAppleIcon(mark) {
  return sharp({ create: { width: APPLE, height: APPLE, channels: 4, background: WHITE } })
    .composite([await beeLayer(mark, APPLE)])
    .png()
    .toBuffer();
}

/** Minimal ICO container. Every entry is a PNG payload, which each of ICO_SIZES' consumers reads. */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const directory = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // 0 means 256
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette size: not paletted
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...directory, ...images.map((image) => image.data)]);
}

/** The tab icon — the vector twin of makeDisc(), identical geometry, disc in BOTH themes (owner,
 *  2026-09-19). No `prefers-color-scheme` branch on purpose: one mark everywhere, and the disc is a
 *  white badge on a light tab strip rather than something that has to be reasoned about per theme.
 *  The bee rides along as a base64 PNG because the brand mark is raster art, not vector; the payload
 *  stays at the mark's native resolution, since <image> is scaled by the viewBox and upsampling here
 *  would only add weight to a file the browser paints at 16-32px. */
async function makeTabSvg(mark) {
  const width = Math.round(MASTER * BEE_SCALE);
  const height = Math.round((width * mark.height) / mark.width);
  const x = Math.round((MASTER - width) / 2);
  const y = Math.round((MASTER - height) / 2);
  const png = mark.buffer.toString('base64');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MASTER} ${MASTER}">
  <circle cx="${MASTER / 2}" cy="${MASTER / 2}" r="${MASTER / 2}" fill="#ffffff"/>
  <image x="${x}" y="${y}" width="${width}" height="${height}" href="data:image/png;base64,${png}"/>
</svg>
`;
}

async function main() {
  const mark = await trimmedMark();

  const master = await makeDisc(mark, MASTER);
  const ico = buildIco(
    await Promise.all(ICO_SIZES.map(async (size) => ({ size, data: await makeDisc(mark, size) }))),
  );

  const outputs = [
    ['icon.png', master],
    ['favicon.ico', ico],
    ['apple-icon.png', await makeAppleIcon(mark)],
    ['icon.svg', await makeTabSvg(mark)],
  ];

  for (const [name, data] of outputs) {
    await writeFile(path.join(APP_DIR, name), data);
    console.log(`wrote apps/web/src/app/${name} (${Buffer.byteLength(data)} bytes)`);
  }
}

await main();
