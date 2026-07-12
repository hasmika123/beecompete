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
