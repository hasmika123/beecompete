'use client';

import { ImageSquare as ImageIcon } from '../icons';
import { FileUpload } from './file-upload';

/**
 * ImageUpload — a drag-or-browse cover-image field. Posts the resulting image URL through a
 * hidden input ({@code name}) so it drops into an ordinary FormData/server-action form.
 *
 * <p>When {@code uploadEnabled} + {@code onSelectFile} are provided (R1-19: presign → PUT the file
 * straight to S3 → public URL), the drop/browse path uploads and stores the returned URL; otherwise
 * the field falls back to pasting an image URL. Pasting a URL always works as a manual override.
 *
 * <p>Since 2026-08-23 this is {@link FileUpload} wearing the image wardrobe — the drop zone, the
 * URL-entry row and the upload flow are shared with the rubric field; only the image-specific
 * parts live here (a real thumbnail as the filled-state preview, the image copy, and an
 * image-only `accept`). Its props are unchanged, so every call site is untouched.
 */

export interface ImageUploadProps {
  /** Hidden input name the resolved image URL is posted under (e.g. "logo"). */
  name: string;
  defaultValue?: string | null;
  /** Spec line under the prompt. */
  hint?: string;
  /** Title shown in the filled state next to the thumbnail (default "Cover image set"). */
  setLabel?: string;
  /** Enables the drag/browse file path once S3 storage exists (default false → URL entry only). */
  uploadEnabled?: boolean;
  /** Future S3 hook: given a chosen file, resolve to its stored URL. */
  onSelectFile?: (file: File) => Promise<string>;
  /** Notified whenever the resolved URL changes (set, replaced, or cleared) — for parent state. */
  onChange?: (url: string) => void;
  /**
   * Tightens the EMPTY state's internals (smaller icon, no spec line, less padding) so the drop
   * zone still reads inside a short or fixed-size frame. The filled state, the URL-entry row and
   * every behaviour are unchanged.
   */
  compact?: boolean;
  /**
   * Classes for the empty drop zone itself — how a caller gives it a fixed shape, e.g. the
   * proportions of the surface the image will actually appear on.
   */
  dropZoneClassName?: string;
  className?: string;
}

export function ImageUpload({
  hint = 'PNG or JPG · up to 5 MB · at least 1200 × 630',
  setLabel = 'Cover image set',
  ...props
}: ImageUploadProps) {
  return (
    <FileUpload
      {...props}
      hint={hint}
      setLabel={setLabel}
      noun="image"
      article="an"
      accept="image/png,image/jpeg,image/webp"
      placeholder="https://images.example.org/cover.jpg"
      removeLabel="Remove cover image"
      urlIcon={<ImageIcon className="size-4" />}
      renderPreview={(url) => (
        // eslint-disable-next-line @next/next/no-img-element -- admin-supplied remote image; no fixed host list
        <img
          src={url}
          alt=""
          className="size-14 shrink-0 rounded-[10px] border border-border object-cover"
        />
      )}
    />
  );
}
