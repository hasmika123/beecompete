import type { Config } from './config.ts';
import type { ImportSubmission } from './types.ts';

export interface SubmitResult {
  id: string;
  status: string;
}

/**
 * POSTs a record into the R1-3 import-review queue (`POST /api/v1/admin/import-records`, guarded
 * by the X-Admin-Token header). The server stores it PENDING with provenance source=import + our
 * confidence; validation happens later on APPROVE, not here (garbage may enter the queue, only
 * reviewed data leaves it). A human curator reviews/edits/approves in the /admin UI — that's S4.
 */
export async function submitToImportQueue(
  submission: ImportSubmission,
  config: Config,
): Promise<SubmitResult> {
  if (!config.adminToken) {
    throw new Error('ADMIN_API_TOKEN is required to submit (set it in env, or use --dry-run)');
  }
  warnIfTokenOverCleartext(config.apiBase);
  const url = `${config.apiBase}/api/v1/admin/import-records`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': config.adminToken,
    },
    body: JSON.stringify(submission),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`import-queue POST failed: ${res.status} ${res.statusText} — ${bodyText}`);
  }
  const body = bodyText ? JSON.parse(bodyText) : {};
  return { id: body.id ?? '(unknown)', status: body.status ?? 'PENDING' };
}

let warnedCleartext = false;

/** L5: shout (once) when the admin token would travel over plain http to a non-local host. */
function warnIfTokenOverCleartext(apiBase: string): void {
  if (warnedCleartext) return;
  let base: URL;
  try {
    base = new URL(apiBase);
  } catch {
    return; // an unparseable base will fail the fetch with its own error
  }
  const host = base.hostname.toLowerCase();
  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (base.protocol === 'http:' && !isLocal) {
    warnedCleartext = true;
    process.stderr.write(
      `\nWARNING: BEECOMPETE_API_BASE (${apiBase}) is plain http to a non-local host — ` +
        'ADMIN_API_TOKEN will be sent in CLEARTEXT. Use https.\n\n',
    );
  }
}
