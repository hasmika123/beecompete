import { readFile } from 'node:fs/promises';
import type { SeedItem } from './pipeline.ts';
import type { SeedHints } from './types.ts';

/**
 * Resolves the CLI input into a list of items. Supports:
 *   - a single URL or local .html path (--input)
 *   - a batch file (--batch): `.csv` (a URL-bearing column, plus hint columns) or a plain
 *     `.txt`/`.list` of URLs.
 * The CSV reader looks for a header column named one of: url, official_url, officialurl, officialUrl,
 * and (when present) pulls per-row HINT columns (name, organizer, category_slug, cost, …).
 * It does NOT hard-depend on docs/seeding/master-index.csv existing (S2 may not have run yet).
 *
 * Items are then DEDUPED by URL: umbrella programs list the same page under several rows (AMC 8/10/12
 * all point at maa.org/student-programs/amc). Extracting one page N times wastes LLM calls and yields
 * N identical records that 409-collide on approve. We keep the first, drop the rest, and record the
 * dropped rows' names on the survivor as a "this page may cover several competitions" curator flag.
 */
const isUrl = (s: string) => /^https?:\/\//i.test(s);

export async function resolveInputs(args: {
  input?: string;
  batch?: string;
  limit?: number;
}): Promise<SeedItem[]> {
  const raw: SeedItem[] = [];
  if (args.input) raw.push({ source: args.input });
  if (args.batch) raw.push(...(await readBatch(args.batch)));
  const deduped = dedupeByUrl(raw);
  return args.limit && args.limit > 0 ? deduped.slice(0, args.limit) : deduped;
}

/** Collapses http(s) items that share a normalized URL; local file paths pass through untouched. */
export function dedupeByUrl(items: SeedItem[]): SeedItem[] {
  const survivors = new Map<string, SeedItem>();
  const out: SeedItem[] = [];
  let dropped = 0;
  for (const item of items) {
    if (!isUrl(item.source)) {
      out.push(item);
      continue;
    }
    const key = normalizeUrl(item.source);
    const survivor = survivors.get(key);
    if (!survivor) {
      survivors.set(key, item);
      out.push(item);
      continue;
    }
    dropped++;
    const otherName = item.hints?.name;
    if (otherName && otherName !== survivor.hints?.name) {
      (survivor.siblingNames ??= []).push(otherName);
    }
  }
  if (dropped > 0) {
    process.stderr.write(
      `deduped ${dropped} row(s) sharing a URL with an earlier row (umbrella programs); ` +
        'each survivor carries a "shares this URL" flag for the curator\n',
    );
  }
  return out;
}

function normalizeUrl(u: string): string {
  return u.trim().toLowerCase().replace(/\/+$/, '');
}

async function readBatch(path: string): Promise<SeedItem[]> {
  const raw = await readFile(path, 'utf8');
  return path.toLowerCase().endsWith('.csv') ? parseCsvUrls(raw) : parseUrlList(raw);
}

function parseUrlList(text: string): SeedItem[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((source) => ({ source }));
}

/** Header names we recognize for each hint field (lowercased). */
const HINT_COLUMNS: Record<keyof SeedHints, string[]> = {
  name: ['name'],
  organizer: ['organizer'],
  categorySlug: ['category_slug', 'categoryslug', 'category'],
  cost: ['cost'],
  participation: ['participation'],
  entryPathway: ['entry_pathway', 'entrypathway'],
  gradeBand: ['grade_band', 'gradeband'],
  regionScope: ['region_scope', 'regionscope'],
};

/** Minimal CSV: splits on commas, handles simple double-quoted fields. Reads the URL + hint columns. */
export function parseCsvUrls(text: string): SeedItem[] {
  const rows = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rows.length === 0) return [];
  const header = splitCsvLine(rows[0]!).map((h) => h.trim().toLowerCase());
  const urlKeys = ['url', 'official_url', 'officialurl', 'official url'];
  const col = header.findIndex((h) => urlKeys.includes(h));
  if (col === -1) {
    throw new Error(
      `batch CSV has no URL column (looked for: ${urlKeys.join(', ')}). Header was: ${header.join(', ')}`,
    );
  }
  // Resolve each hint field to its column index (first header alias that matches), if present.
  const hintCols = new Map<keyof SeedHints, number>();
  for (const [field, aliases] of Object.entries(HINT_COLUMNS) as [keyof SeedHints, string[]][]) {
    const idx = header.findIndex((h) => aliases.includes(h));
    if (idx !== -1) hintCols.set(field, idx);
  }

  const items: SeedItem[] = [];
  for (const row of rows.slice(1)) {
    const cells = splitCsvLine(row);
    const source = cells[col]?.trim();
    if (!source) continue;
    const hints = readHints(cells, hintCols);
    items.push(hints ? { source, hints } : { source });
  }
  return items;
}

function readHints(cells: string[], hintCols: Map<keyof SeedHints, number>): SeedHints | undefined {
  const hints: SeedHints = {};
  let any = false;
  for (const [field, idx] of hintCols) {
    const value = cells[idx]?.trim();
    // "unknown" is a placeholder in the index, not a fact — treat it as absent.
    if (value && value.toLowerCase() !== 'unknown') {
      hints[field] = value;
      any = true;
    }
  }
  return any ? hints : undefined;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}
