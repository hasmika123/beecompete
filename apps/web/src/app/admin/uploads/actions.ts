'use server';

import { adminFetch } from '@/lib/admin-api';

export interface CoverUploadTarget {
  uploadUrl: string;
  publicUrl: string;
}

/**
 * R1-19: ask the API (which holds the AWS credentials) for a short-TTL pre-signed PUT URL for a
 * cover image. The browser then uploads the file DIRECTLY to S3 — the bytes never pass through the
 * API or this BFF. `contentType` + `sizeBytes` are validated server-side before a URL is minted.
 */
export async function requestCoverUploadUrl(
  contentType: string,
  sizeBytes: number,
): Promise<CoverUploadTarget> {
  return adminFetch<CoverUploadTarget>('/uploads/cover', {
    method: 'POST',
    body: { contentType, sizeBytes },
  });
}
