import { readFile } from 'node:fs/promises';
import { scoreConfidence } from './confidence.ts';
import type { Config } from './config.ts';
import { extract, type ExtractBackend } from './extract.ts';
import { fetchPage, htmlToText } from './fetch.ts';
import { submitToImportQueue } from './submit.ts';
import type { ImportSubmission } from './types.ts';
import { validatePayload } from './validate.ts';

export interface SeedItem {
  /** An http(s) URL to fetch, OR a local .html file path (offline/fixture path). */
  source: string;
}

export interface RunOptions {
  dryRun: boolean;
  offline: boolean;
  /** SSRF-guard opt-out for the fetch step (--allow-private). */
  allowPrivate?: boolean;
}

export interface ItemReport {
  source: string;
  backend?: ExtractBackend;
  confidence?: number;
  valid: boolean;
  errors: string[];
  /** Non-blocking hints for the human reviewer (domain mismatch, odd field combos). */
  warnings: string[];
  /** Model uncertainty notes for the S4 reviewer (M1 — printed, never POSTed). */
  reviewerNotes?: string;
  submission?: ImportSubmission;
  submittedId?: string;
  outcome: 'dry-run' | 'submitted' | 'invalid' | 'error';
  message?: string;
}

const isUrl = (s: string) => /^https?:\/\//i.test(s);

/** Full single-item pipeline: fetch/read -> extract -> validate -> score -> (dry-run | submit). */
export async function runItem(
  item: SeedItem,
  config: Config,
  opts: RunOptions,
): Promise<ItemReport> {
  try {
    const { sourceUrl, pageText, inputPath, remote } = await acquireText(item, config, opts);
    const { extraction, backend } = await extract({ sourceUrl, pageText, inputPath }, config, {
      offline: opts.offline,
    });

    const { ok, errors, warnings } = validatePayload(extraction.payload);
    warnings.push(...crossCheckOfficialUrl(extraction.payload.officialUrl, sourceUrl, remote));
    const confidence = scoreConfidence(extraction);
    // H2: sourceUrl is ALWAYS the URL we actually fetched (or the local file path) — never the
    // LLM-extracted officialUrl, which page content can steer. officialUrl stays in the payload.
    const submission: ImportSubmission = {
      payload: extraction.payload,
      sourceUrl,
      confidence,
    };

    const base = {
      source: item.source,
      backend,
      confidence,
      warnings,
      ...(extraction.reviewerNotes ? { reviewerNotes: extraction.reviewerNotes } : {}),
      submission,
    };

    if (!ok) {
      return { ...base, valid: false, errors, outcome: 'invalid' };
    }
    if (opts.dryRun) {
      return { ...base, valid: true, errors: [], outcome: 'dry-run' };
    }
    const result = await submitToImportQueue(submission, config);
    return {
      ...base,
      valid: true,
      errors: [],
      submittedId: result.id,
      outcome: 'submitted',
      message: `queued ${result.id} (${result.status})`,
    };
  } catch (err) {
    return {
      source: item.source,
      valid: false,
      errors: [],
      warnings: [],
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * H2 companion check: when the LLM's officialUrl points somewhere other than the site we actually
 * fetched, flag it for the reviewer — a page-injected "official URL" is exactly how a phishing
 * domain would try to ride an extraction. Registrable-domain comparison is the naive last-two-
 * labels heuristic (no public-suffix list in v0), which is enough to catch cross-site steering.
 */
function crossCheckOfficialUrl(
  officialUrl: string | null | undefined,
  fetchedUrl: string,
  remote: boolean,
): string[] {
  if (!remote || !officialUrl) return [];
  let official: URL;
  let fetched: URL;
  try {
    official = new URL(officialUrl);
    fetched = new URL(fetchedUrl);
  } catch {
    return []; // malformed URLs are reported by validatePayload
  }
  if (registrableDomain(official.hostname) !== registrableDomain(fetched.hostname)) {
    return [
      `officialUrl domain (${official.hostname}) differs from the fetched page's domain ` +
        `(${fetched.hostname}) — verify before approving`,
    ];
  }
  return [];
}

function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().split('.').filter(Boolean);
  return labels.slice(-2).join('.');
}

async function acquireText(
  item: SeedItem,
  config: Config,
  opts: RunOptions,
): Promise<{ sourceUrl: string; pageText: string; inputPath?: string; remote: boolean }> {
  if (isUrl(item.source)) {
    const page = await fetchPage(item.source, config, { allowPrivate: opts.allowPrivate });
    return { sourceUrl: page.finalUrl, pageText: page.text, remote: true };
  }
  // Local HTML file — the offline/fixture path.
  const html = await readFile(item.source, 'utf8');
  return {
    sourceUrl: item.source,
    pageText: htmlToText(html),
    inputPath: item.source,
    remote: false,
  };
}
