import { readFile } from 'node:fs/promises';
import type { SeedItem } from './pipeline.ts';

/**
 * Resolves the CLI input into a list of items. Supports:
 *   - a single URL or local .html path (--input)
 *   - a batch file (--batch): `.csv` (a URL-bearing column) or a plain `.txt`/`.list` of URLs.
 * The CSV reader looks for a header column named one of: url, official_url, officialurl, officialUrl.
 * It does NOT hard-depend on docs/seeding/master-index.csv existing (S2 may not have run yet).
 */
export async function resolveInputs(args: {
  input?: string;
  batch?: string;
  limit?: number;
}): Promise<SeedItem[]> {
  let items: SeedItem[] = [];
  if (args.input) items.push({ source: args.input });
  if (args.batch) items.push(...(await readBatch(args.batch)));
  if (args.limit && args.limit > 0) items = items.slice(0, args.limit);
  return items;
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

/** Minimal CSV: splits on commas, handles simple double-quoted fields. Good enough for a URL column. */
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
  const items: SeedItem[] = [];
  for (const row of rows.slice(1)) {
    const cells = splitCsvLine(row);
    const source = cells[col]?.trim();
    if (source) items.push({ source });
  }
  return items;
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
