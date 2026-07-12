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
}

export interface ItemReport {
  source: string;
  backend?: ExtractBackend;
  confidence?: number;
  valid: boolean;
  errors: string[];
  submission?: ImportSubmission;
  submittedId?: string;
  outcome: 'dry-run' | 'submitted' | 'invalid' | 'error';
  message?: string;
}

const isUrl = (s: string) => /^https?:\/\//i.test(s);

/** Full single-item pipeline: fetch/read -> extract -> validate -> score -> (dry-run | submit). */
export async function runItem(item: SeedItem, config: Config, opts: RunOptions): Promise<ItemReport> {
  try {
    const { sourceUrl, pageText, inputPath } = await acquireText(item, config);
    const { extraction, backend } = await extract({ sourceUrl, pageText, inputPath }, config, {
      offline: opts.offline,
    });

    const { ok, errors } = validatePayload(extraction.payload);
    const confidence = scoreConfidence(extraction);
    const submission: ImportSubmission = {
      payload: extraction.payload,
      sourceUrl: extraction.payload.officialUrl ?? sourceUrl,
      confidence,
    };

    if (!ok) {
      return { source: item.source, backend, confidence, valid: false, errors, submission, outcome: 'invalid' };
    }
    if (opts.dryRun) {
      return { source: item.source, backend, confidence, valid: true, errors: [], submission, outcome: 'dry-run' };
    }
    const result = await submitToImportQueue(submission, config);
    return {
      source: item.source,
      backend,
      confidence,
      valid: true,
      errors: [],
      submission,
      submittedId: result.id,
      outcome: 'submitted',
      message: `queued ${result.id} (${result.status})`,
    };
  } catch (err) {
    return {
      source: item.source,
      valid: false,
      errors: [],
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function acquireText(
  item: SeedItem,
  config: Config,
): Promise<{ sourceUrl: string; pageText: string; inputPath?: string }> {
  if (isUrl(item.source)) {
    const page = await fetchPage(item.source, config);
    return { sourceUrl: page.finalUrl, pageText: page.text };
  }
  // Local HTML file — the offline/fixture path.
  const html = await readFile(item.source, 'utf8');
  return { sourceUrl: item.source, pageText: htmlToText(html), inputPath: item.source };
}
