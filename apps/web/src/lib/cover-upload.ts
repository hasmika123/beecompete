import { requestCoverUploadUrl } from '@/app/admin/uploads/actions';

/**
 * Cover upload (R1-19): presign via the BFF, then PUT the file straight to S3 with the SAME
 * Content-Type that was signed (the signature includes it), and return the public object URL to
 * store in `competition.logo`. Runs in the browser — the file bytes go directly to the bucket.
 *
 * Every failure path throws an Error whose message names the actual cause. The drop zone shows it
 * verbatim, because the three real failures need three different fixes: a 503 means the API has no
 * bucket configured, a 422 means the file itself was rejected, and a blocked PUT means the bucket's
 * CORS rules don't list this origin.
 */
export async function uploadCoverImage(file: File): Promise<string> {
  const presign = await requestCoverUploadUrl(file.type, file.size);
  if (!presign.ok) throw new Error(presign.error);
  const { uploadUrl, publicUrl } = presign.target;

  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
  } catch {
    // fetch rejects (rather than returning a status) when the browser blocks the request, and for a
    // presigned PUT that is nearly always the bucket's CORS rules missing this origin — a response
    // the page is not allowed to read looks identical to no response at all.
    throw new Error("the browser couldn't reach the storage bucket — check its CORS rules");
  }
  if (!res.ok) throw new Error(`the storage bucket rejected the upload (${res.status})`);
  return publicUrl;
}
