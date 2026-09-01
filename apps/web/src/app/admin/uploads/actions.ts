'use server';

import { AdminApiError, adminFetch } from '@/lib/admin-api';

export interface CoverUploadTarget {
  uploadUrl: string;
  publicUrl: string;
}

/**
 * Presign outcome. A failure is RETURNED, not thrown: Next redacts the message of an error thrown
 * out of a Server Action in a production build, so the API's own reason ("cover upload isn't
 * configured; set S3_BUCKET…") never reached the admin — every cause arrived as the same generic
 * "that upload didn't go through". Returning it keeps the reason intact in every build.
 */
export type CoverUploadPresign =
  { ok: true; target: CoverUploadTarget } | { ok: false; error: string };

/**
 * R1-19: ask the API (which holds the AWS credentials) for a short-TTL pre-signed PUT URL for a
 * cover image. The browser then uploads the file DIRECTLY to S3 — the bytes never pass through the
 * API or this BFF. `contentType` + `sizeBytes` are validated server-side before a URL is minted.
 */
export async function requestCoverUploadUrl(
  contentType: string,
  sizeBytes: number,
): Promise<CoverUploadPresign> {
  try {
    const target = await adminFetch<CoverUploadTarget>('/uploads/cover', {
      method: 'POST',
      body: { contentType, sizeBytes },
    });
    return { ok: true, target };
  } catch (err) {
    // AdminApiError already carries the API's `message` (ApiExceptionHandler echoes the reason we
    // set); anything else is a transport failure and its message is the best hint we have.
    if (err instanceof AdminApiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : 'could not reach the API' };
  }
}
