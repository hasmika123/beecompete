import { requestCoverUploadUrl } from '@/app/admin/uploads/actions';

/**
 * Cover upload (R1-19): presign via the BFF, then PUT the file straight to S3 with the SAME
 * Content-Type that was signed (the signature includes it), and return the public object URL to
 * store in `competition.logo`. Runs in the browser — the file bytes go directly to the bucket.
 */
export async function uploadCoverImage(file: File): Promise<string> {
  const { uploadUrl, publicUrl } = await requestCoverUploadUrl(file.type, file.size);
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return publicUrl;
}
