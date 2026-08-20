/**
 * S3 pre-flight — measures `official_url` QUALITY across the master index, before LLM calls or
 * curator hours are spent on it.
 *
 * Why this exists: the first 5-page sweep (2026-08-20) produced one record with no edition at all.
 * The National Speech & Debate Association row points at the organization's front door, not at a
 * competition page, so there was no running to extract and the listing would have published
 * hidden. Extraction quality is bounded by URL quality, and that ceiling is far cheaper to measure
 * than to discover one paid extraction at a time.
 *
 * There are NO LLM calls here — the classifier is a keyword heuristic over the same distilled text
 * the extractor would see. That makes it free and repeatable, and it also means the verdicts are
 * TRIAGE, NOT TRUTH: THIN means "a human should glance at this", not "this is broken". Treat the
 * report the way S4 treats the index itself (README: "hints, not truth").
 */

import { loadConfig } from './config.ts';
import { fetchPage } from './fetch.ts';
import type { SeedItem } from './pipeline.ts';

/** Polite parallelism. The index is ~450 rows; six at a time finishes in minutes, not hours. */
export const DEFAULT_CONCURRENCY = 6;
/** Minimum gap between two hits on the SAME host — umbrella orgs own many rows (maa.org, ACS). */
const HOST_MIN_GAP_MS = 400;

/**
 * Text that says "this page describes an enterable competition". Deliberately broad and matched
 * against lowercased text: we are counting evidence, not parsing.
 */
const COMPETITION_MARKERS: Array<[label: string, re: RegExp]> = [
  ['registration', /\bregistrations?\b|\bregister\b|\bregistering\b/],
  ['deadline', /\bdeadlines?\b|\bdue date\b|\bcloses on\b/],
  ['eligibility', /\beligib/],
  ['fee', /\bentry fee\b|\bregistration fee\b|\bno cost to enter\b/],
  ['how-to-enter', /\bhow to (enter|participate|compete|register|apply)\b/],
  ['dates-block', /\b(important|key|competition|contest) dates\b/],
  ['rules', /\b(contest|competition|official) rules\b|\bguidelines\b/],
  ['submission', /\bsubmissions?\b|\bsubmit your\b/],
  ['qualifying', /\bqualif(y|ying|ier|ication)/],
  ['grade-band', /\bgrades? \d|\bhigh school\b|\bmiddle school\b|\bk-12\b/],
  ['plausible-year', /\b20(2[5-9]|3\d)\b/],
];

/**
 * Text typical of an ORGANIZATION front door. A high count here alongside a low competition count
 * is the NSDA shape: a real, healthy page that simply is not about one runnable competition.
 */
const HOMEPAGE_MARKERS: Array<[label: string, re: RegExp]> = [
  ['donate', /\bdonate\b|\bdonations?\b|\bgive today\b/],
  ['membership', /\bmembership\b|\bbecome a member\b|\bmember benefits\b/],
  ['about-us', /\babout us\b|\bour mission\b|\bwho we are\b/],
  ['governance', /\bboard of directors\b|\bleadership team\b|\bour staff\b/],
  ['careers', /\bcareers\b|\bjob openings\b|\bwork with us\b/],
  ['newsroom', /\bnewsroom\b|\blatest news\b|\bpress releases?\b/],
  ['annual-report', /\bannual report\b/],
];

/** A deep page needs this much evidence to be worth extracting unattended. */
const PROGRAM_MIN_SIGNALS = 4;
/** A root URL has to work harder: a single-competition org's homepage IS the competition page. */
const ROOT_PROGRAM_MIN_SIGNALS = 6;
/** …and must not also read like a multi-program org front door. */
const ROOT_MAX_HOMEPAGE_SIGNALS = 1;

export type Verdict =
  /** Reads like a competition page. Extract it as-is. */
  | 'PROGRAM'
  /** An org front door. Expect a thin record (often no edition) — find the program page first. */
  | 'HOMEPAGE'
  /** Reachable deep page with little competition evidence. A human should glance at it. */
  | 'THIN'
  /** Could not be read at all: dead, bot-blocked, robots-disallowed, or not HTML. */
  | 'UNREACHABLE';

export interface Classification {
  verdict: Verdict;
  competitionSignals: string[];
  homepageSignals: string[];
  /** The requested URL had a path but we landed on the site root — that program page is gone. */
  redirectedToRoot: boolean;
}

export interface AuditRow extends Classification {
  /** 1-based position in the audited list, i.e. rank order within the index. */
  rank: number;
  name: string;
  category: string;
  requestedUrl: string;
  finalUrl: string;
  /** Populated only for UNREACHABLE — the fetch error, flattened to one line. */
  problem: string;
}

/** True when the URL addresses a site root (`/`, or a bare origin) rather than a specific page. */
export function isRootUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.pathname === '' || u.pathname === '/') && u.search === '';
  } catch {
    return false;
  }
}

function hits(text: string, markers: Array<[string, RegExp]>): string[] {
  return markers.filter(([, re]) => re.test(text)).map(([label]) => label);
}

/**
 * Sorts one fetched page. Pure, so the thresholds above stay testable — they are judgment calls
 * tuned against the first sweep, and they are the part most likely to need adjusting later.
 */
export function classifyPage(args: {
  requestedUrl: string;
  finalUrl: string;
  text: string;
}): Classification {
  const text = args.text.toLowerCase();
  const competitionSignals = hits(text, COMPETITION_MARKERS);
  const homepageSignals = hits(text, HOMEPAGE_MARKERS);
  const landedAtRoot = isRootUrl(args.finalUrl);
  const redirectedToRoot = landedAtRoot && !isRootUrl(args.requestedUrl);

  let verdict: Verdict;
  if (redirectedToRoot) {
    // The index named a specific page and the site sent us home: that page is gone. No amount of
    // homepage evidence makes this the right URL to extract a running from.
    verdict = 'HOMEPAGE';
  } else if (landedAtRoot) {
    verdict =
      competitionSignals.length >= ROOT_PROGRAM_MIN_SIGNALS &&
      homepageSignals.length <= ROOT_MAX_HOMEPAGE_SIGNALS
        ? 'PROGRAM'
        : 'HOMEPAGE';
  } else {
    verdict = competitionSignals.length >= PROGRAM_MIN_SIGNALS ? 'PROGRAM' : 'THIN';
  }

  return { verdict, competitionSignals, homepageSignals, redirectedToRoot };
}

/** Spaces same-host requests out; hosts run in parallel, a single host politely in series. */
class HostThrottle {
  private readonly lastHit = new Map<string, number>();

  async wait(url: string): Promise<void> {
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      return;
    }
    const previous = this.lastHit.get(host);
    const now = Date.now();
    if (previous !== undefined && now - previous < HOST_MIN_GAP_MS) {
      await new Promise((r) => setTimeout(r, HOST_MIN_GAP_MS - (now - previous)));
    }
    this.lastHit.set(host, Date.now());
  }
}

async function auditOne(item: SeedItem, rank: number, throttle: HostThrottle): Promise<AuditRow> {
  const base = {
    rank,
    name: item.hints?.name ?? '(unnamed)',
    category: item.hints?.categorySlug ?? '',
    requestedUrl: item.source,
  };
  try {
    await throttle.wait(item.source);
    const page = await fetchPage(item.source, loadConfig());
    return {
      ...base,
      ...classifyPage({ requestedUrl: item.source, finalUrl: page.finalUrl, text: page.text }),
      finalUrl: page.finalUrl,
      problem: '',
    };
  } catch (err) {
    // Every failure mode lands here by design: a dead host, a 404, a 403 bot-block, a
    // robots-disallow and a PDF-not-HTML are all "we cannot extract this", and the message says
    // which. The distinction matters to a human triaging the row, not to the verdict.
    return {
      ...base,
      verdict: 'UNREACHABLE',
      competitionSignals: [],
      homepageSignals: [],
      redirectedToRoot: false,
      finalUrl: '',
      problem: describeFailure(err),
    };
  }
}

/**
 * Flattens a fetch failure into one triage-ready line.
 *
 * undici reports every transport fault as the bare string "fetch failed" and hides the real cause
 * on `err.cause.code`. That distinction is the whole point of the audit's UNREACHABLE bucket: a
 * dead domain (ENOTFOUND) means drop or re-source the row, while an expired certificate or a
 * blocked user-agent means the competition is alive and only the fetch needs work. Without the
 * unwrap, 29 of the first run's 68 failures were indistinguishable.
 */
export function describeFailure(err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err)).replace(/\s+/g, ' ');
  const message = stripQueryStrings(raw);
  const cause = err instanceof Error ? (err.cause as { code?: string } | undefined) : undefined;
  const code = typeof cause?.code === 'string' ? cause.code : '';
  return (code && message === 'fetch failed' ? `${code} (${message})` : message).slice(0, 200);
}

/**
 * Drops the query string from any URL quoted in an error message.
 *
 * Bot-protection redirects (queue-it, Cloudflare challenges) append a fresh high-entropy session
 * token on every request. Recording those in a committed report is bad twice over: the token is
 * meaningless to a curator and re-churns the file on every re-audit, and gitleaks reads it as a
 * leaked `generic-api-key` and fails CI. Paths are kept — only the `?...` goes.
 */
function stripQueryStrings(message: string): string {
  return message.replace(/(https?:\/\/[^\s?]+)\?\S*/g, '$1?…');
}

/** Runs `worker` over `items` with at most `limit` in flight, preserving input order in the output. */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]!, i);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function runAudit(
  items: SeedItem[],
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<AuditRow[]> {
  const throttle = new HostThrottle();
  let done = 0;
  return await mapWithLimit(items, opts.concurrency ?? DEFAULT_CONCURRENCY, async (item, i) => {
    const row = await auditOne(item, i + 1, throttle);
    opts.onProgress?.(++done, items.length);
    return row;
  });
}

const csvCell = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function toCsv(rows: AuditRow[]): string {
  const header = [
    'rank',
    'name',
    'category',
    'verdict',
    'requested_url',
    'final_url',
    'redirected_to_root',
    'competition_signals',
    'homepage_signals',
    'problem',
  ];
  const lines = rows.map((r) =>
    [
      String(r.rank),
      r.name,
      r.category,
      r.verdict,
      r.requestedUrl,
      r.finalUrl,
      r.redirectedToRoot ? 'yes' : '',
      r.competitionSignals.join(' '),
      r.homepageSignals.join(' '),
      r.problem,
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n') + '\n';
}

/** The reason a row needs human attention, in the words a curator would use. */
export function whyNeedsWork(row: AuditRow): string {
  if (row.problem) return row.problem;
  if (row.redirectedToRoot) return 'deep link redirects to the site root — that page is gone';
  return 'org front door, not a competition page';
}

export function summarize(rows: AuditRow[], listCap = 40): string {
  const order: Verdict[] = ['PROGRAM', 'THIN', 'HOMEPAGE', 'UNREACHABLE'];
  const out: string[] = ['', `${rows.length} URLs audited`, ''];

  for (const verdict of order) {
    const n = rows.filter((r) => r.verdict === verdict).length;
    const pct = rows.length === 0 ? 0 : Math.round((n / rows.length) * 100);
    out.push(`  ${verdict.padEnd(12)} ${String(n).padStart(4)}  ${String(pct).padStart(3)}%`);
  }

  const categories = [...new Set(rows.map((r) => r.category))].filter(Boolean).sort();
  if (categories.length > 1) {
    out.push('', 'by category            program  thin  home  dead', '');
    for (const c of categories) {
      const inCat = rows.filter((r) => r.category === c);
      const n = (v: Verdict) => String(inCat.filter((r) => r.verdict === v).length).padStart(5);
      out.push(`  ${c.padEnd(22)}${n('PROGRAM')}${n('THIN')}${n('HOMEPAGE')}${n('UNREACHABLE')}`);
    }
  }

  const needsWork = rows.filter((r) => r.verdict === 'HOMEPAGE' || r.verdict === 'UNREACHABLE');
  if (needsWork.length > 0) {
    out.push('', `${needsWork.length} row(s) need a better URL before extraction:`, '');
    for (const r of needsWork.slice(0, listCap)) {
      out.push(`  [${r.verdict}] #${r.rank} ${r.name}`);
      out.push(`      ${r.requestedUrl}`);
      out.push(`      ${whyNeedsWork(r)}`);
    }
    if (needsWork.length > listCap) {
      out.push(`  … and ${needsWork.length - listCap} more (see the CSV)`);
    }
  }
  return out.join('\n');
}
