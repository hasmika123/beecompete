'use client';

import { useRef, useState } from 'react';
import { ImageSquare as ImageIcon, Upload, X } from '../icons';
import { cn } from '../lib/cn';

/**
 * ImageUpload — a drag-or-browse cover-image field. Posts the resulting image URL through a
 * hidden input ({@code name}) so it drops into an ordinary FormData/server-action form.
 *
 * <p>When {@code uploadEnabled} + {@code onSelectFile} are provided (R1-19: presign → PUT the file
 * straight to S3 → public URL), the drop/browse path uploads and stores the returned URL; otherwise
 * the field falls back to pasting an image URL. Pasting a URL always works as a manual override.
 */

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

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
  className?: string;
}

const PENDING_NOTE = 'Direct upload isn’t enabled yet — paste an image URL for now.';

export function ImageUpload({
  name,
  defaultValue,
  hint = 'PNG or JPG · up to 5 MB · at least 1200 × 630',
  setLabel = 'Cover image set',
  uploadEnabled = false,
  onSelectFile,
  onChange,
  className,
}: ImageUploadProps) {
  const initial = defaultValue ?? '';
  const [url, setUrl] = useState(initial);
  const [showUrl, setShowUrl] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [note, setNote] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Single write path for the resolved URL so the parent (onChange) always stays in sync.
  const commit = (next: string) => {
    setUrl(next);
    onChange?.(next);
  };

  const hasImage = isHttpUrl(url);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!uploadEnabled || !onSelectFile) {
      setNote(PENDING_NOTE);
      setShowUrl(true);
      return;
    }
    setUploading(true);
    setNote(null);
    try {
      const stored = await onSelectFile(file);
      commit(stored);
      setNote(null);
    } catch {
      setNote('That upload didn’t go through. Try again, or paste an image URL.');
      setShowUrl(true);
    } finally {
      setUploading(false);
    }
  }

  function applyUrl() {
    const next = draft.trim();
    if (next === '') {
      commit('');
      setShowUrl(false);
      setNote(null);
      return;
    }
    if (!isHttpUrl(next)) {
      setNote('Enter a full image URL starting with http(s)://');
      return;
    }
    commit(next);
    setShowUrl(false);
    setNote(null);
  }

  function clear() {
    commit('');
    setDraft('');
    setShowUrl(false);
    setNote(null);
  }

  return (
    // min-w-0: as a grid/flex item, let the field shrink below its content's min-content so the
    // long image-URL line (a `truncate` nowrap element) can ellipsis instead of forcing the track
    // wide (e.g. inside a two-column form section).
    <div className={cn('grid min-w-0 gap-2', className)}>
      {/* The value the form actually posts. */}
      <input type="hidden" name={name} value={url} />

      {hasImage ? (
        <div className="flex min-w-0 items-center gap-3 rounded-[var(--radius-field)] border border-border bg-surface-raised p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-supplied remote image; no fixed host list */}
          <img
            src={url}
            alt=""
            className="size-14 shrink-0 rounded-[10px] border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{setLabel}</p>
            <p className="truncate text-xs text-muted">{url}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraft(url);
              setShowUrl(true);
            }}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-background hover:text-foreground"
          >
            Change
          </button>
          <button
            type="button"
            onClick={clear}
            aria-label="Remove cover image"
            className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-danger"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : uploading ? (
        <div className="flex items-center justify-center gap-2 rounded-[var(--radius-panel)] border border-dashed border-border bg-surface px-5 py-6 text-sm text-muted">
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-border border-t-brand-gold"
          />
          Uploading…
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'flex flex-col items-center gap-2 rounded-[var(--radius-panel)] border border-dashed px-5 py-6 text-center transition-colors',
            dragOver ? 'border-brand-gold bg-brand-gold-soft/40' : 'border-border bg-surface',
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface-raised text-brand-gold">
            <Upload className="size-5" />
          </span>
          <p className="text-sm text-foreground">
            <button
              type="button"
              onClick={() =>
                uploadEnabled ? fileRef.current?.click() : (setNote(PENDING_NOTE), setShowUrl(true))
              }
              className="font-semibold text-brand-gold hover:underline"
            >
              Drag an image here, or browse
            </button>
          </p>
          <p className="text-xs text-muted">{hint}</p>
          <button
            type="button"
            onClick={() => setShowUrl((s) => !s)}
            className="text-xs text-muted underline underline-offset-2 hover:text-foreground"
          >
            or paste an image URL
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {showUrl && !hasImage && (
        <div className="flex items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-field)] border border-border bg-surface-raised text-muted">
            <ImageIcon className="size-4" />
          </span>
          <input
            type="url"
            inputMode="url"
            aria-label="Image URL"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyUrl();
              }
            }}
            placeholder="https://images.example.org/cover.jpg"
            className="h-9 min-w-0 flex-1 rounded-[var(--radius-field)] border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={applyUrl}
            className="h-9 shrink-0 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground"
          >
            Add
          </button>
        </div>
      )}

      {note && <p className="text-xs text-amber-700 dark:text-amber-400">{note}</p>}
    </div>
  );
}
