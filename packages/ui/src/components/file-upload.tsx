'use client';

import { useRef, useState, type ReactNode } from 'react';
import { LinkIcon, Upload, X } from '../icons';
import { cn } from '../lib/cn';

/**
 * FileUpload — a drag-or-browse field that resolves to a URL and posts it through a hidden input
 * ({@code name}), so it drops into an ordinary FormData/server-action form.
 *
 * <p>When {@code uploadEnabled} + {@code onSelectFile} are provided (presign → PUT straight to S3
 * → public URL), the drop/browse path uploads and stores the returned URL; otherwise the field
 * falls back to pasting a URL, which always works as a manual override. That fallback is the
 * DESIGNED half-state, not a stub: a rubric that already lives on the organizer's site should be
 * linked, never re-hosted.
 *
 * <p>Every noun in the copy comes from {@code noun}/{@code article} so one component serves images,
 * PDFs and anything else — {@link ImageUpload} is this component with the image wardrobe on.
 */

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

export interface FileUploadProps {
  /**
   * Hidden input name the resolved URL is posted under (e.g. "logo"). Omit when the caller owns
   * the value some other way ({@code onChange} into a JSON bag, say) — a nameless control isn't
   * submitted, so leaving it off posts nothing rather than posting an ignored field.
   */
  name?: string;
  defaultValue?: string | null;
  /** Spec line under the prompt. */
  hint?: string;
  /** Title shown in the filled state next to the preview (e.g. "Rubric attached"). */
  setLabel?: string;
  /** Enables the drag/browse file path once storage exists (default false → URL entry only). */
  uploadEnabled?: boolean;
  /** Given a chosen file, resolve to its stored URL. */
  onSelectFile?: (file: File) => Promise<string>;
  /** Notified whenever the resolved URL changes (set, replaced, or cleared) — for parent state. */
  onChange?: (url: string) => void;
  /**
   * Tightens the EMPTY state's internals (smaller icon, no spec line, less padding) so the drop
   * zone still reads inside a short or fixed-size frame. The filled state, the URL-entry row and
   * every behaviour are unchanged.
   */
  compact?: boolean;
  /** Classes for the empty drop zone itself — how a caller gives it a fixed shape. */
  dropZoneClassName?: string;
  className?: string;
  /** `accept` for the hidden file input (default: anything). */
  accept?: string;
  /** What is being attached, lowercase, for the copy: "image", "PDF", "file". */
  noun?: string;
  /** The article that reads correctly before {@code noun} — "an" for image, "a" for PDF. */
  article?: string;
  /** Filled-state preview left of the label. Defaults to an icon tile. */
  renderPreview?: (url: string) => ReactNode;
  /** Icon for the URL-entry row (and the default filled preview). */
  urlIcon?: ReactNode;
  placeholder?: string;
  /** aria-label for the remove button (default "Remove {noun}"). */
  removeLabel?: string;
}

export function FileUpload({
  name,
  defaultValue,
  hint,
  setLabel,
  uploadEnabled = false,
  onSelectFile,
  onChange,
  compact = false,
  dropZoneClassName,
  className,
  accept,
  noun = 'file',
  article = 'a',
  renderPreview,
  urlIcon,
  placeholder = 'https://…',
  removeLabel,
}: FileUploadProps) {
  const initial = defaultValue ?? '';
  const [url, setUrl] = useState(initial);
  const [showUrl, setShowUrl] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [note, setNote] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const nounPhrase = `${article} ${noun}`;
  const nounTitle = noun.charAt(0).toUpperCase() + noun.slice(1);
  const pendingNote = `Direct upload isn’t enabled yet. Paste ${nounPhrase} URL for now.`;
  const icon = urlIcon ?? <LinkIcon className="size-4" />;

  // Single write path for the resolved URL so the parent (onChange) always stays in sync.
  const commit = (next: string) => {
    setUrl(next);
    onChange?.(next);
  };

  const hasFile = isHttpUrl(url);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!uploadEnabled || !onSelectFile) {
      setNote(pendingNote);
      setShowUrl(true);
      return;
    }
    setUploading(true);
    setNote(null);
    try {
      const stored = await onSelectFile(file);
      commit(stored);
      setNote(null);
    } catch (err) {
      // The note only — the URL row is NOT forced open (owner 2026-08-28). A failed upload is
      // usually worth retrying, and swapping the drop zone's companion row in unprompted both
      // moves the layout under the cursor and reads as "uploading is broken, do it the other way"
      // when the honest answer is "that attempt failed". The "or paste … URL" toggle is right
      // there for anyone who wants it.
      //
      // The uploader's REASON is shown when it gave one. Without it, a missing bucket, a rejected
      // file and a CORS block all read as the same sentence, and only one of the three is worth
      // retrying — which is what the generic note tells you to do.
      const reason =
        err instanceof Error && err.message.trim()
          ? ` ${err.message.trim().replace(/\.$/, '')}.`
          : '';
      setNote(`That upload didn’t go through.${reason} Try again, or paste ${nounPhrase} URL.`);
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
      setNote(`Enter a full ${noun} URL starting with http(s)://`);
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
    // long URL line (a `truncate` nowrap element) can ellipsis instead of forcing the track wide.
    <div className={cn('grid min-w-0 gap-2', className)}>
      {/* The value the form actually posts — only when the caller asked for a posted field. */}
      {name != null && <input type="hidden" name={name} value={url} />}

      {hasFile ? (
        <div className="flex min-w-0 items-center gap-3 rounded-[var(--radius-field)] border border-border bg-surface-raised p-2.5">
          {renderPreview ? (
            renderPreview(url)
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface text-brand-gold">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {setLabel ?? `${nounTitle} set`}
            </p>
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
            aria-label={removeLabel ?? `Remove ${noun}`}
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
        // THE WHOLE ZONE IS CLICKABLE (owner 2026-08-28) — it looks like a target, so clicking
        // anywhere in it should do the thing: browse when uploads are on, open URL entry when not. The inner "browse" button stays a real <button> because it
        // is what makes this keyboard-reachable; both it and the URL toggle stopPropagation so a
        // click on either doesn't also fire this handler. Not a <button> itself: it contains
        // buttons, and nesting those is invalid HTML and breaks AT.
        <div
          onClick={() => {
            // Uploads OFF is a designed half-state, not a broken one (a rubric that lives on the
            // organizer's site should be linked, never re-hosted) — so the zone still responds:
            // it opens URL entry, the same thing its "browse" button does in that mode. Doing
            // nothing made the box look dead.
            if (uploadEnabled) fileRef.current?.click();
            else {
              setNote(pendingNote);
              setShowUrl(true);
            }
          }}
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
            'flex flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed text-center transition-colors',
            compact ? 'gap-1.5 px-3 py-3' : 'gap-2 px-5 py-6',
            dragOver ? 'border-brand-gold bg-brand-gold-soft/40' : 'border-border bg-surface',
            'cursor-pointer',
            dropZoneClassName,
          )}
        >
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-brand-gold',
              compact ? 'size-8' : 'size-11',
            )}
          >
            <Upload className={compact ? 'size-4' : 'size-5'} />
          </span>
          <div className={cn('min-w-0', compact && 'grid gap-0.5')}>
            <p className="text-sm text-foreground">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation(); // the zone itself already handles this click
                  if (uploadEnabled) fileRef.current?.click();
                  else {
                    setNote(pendingNote);
                    setShowUrl(true);
                  }
                }}
                className="font-semibold text-brand-gold hover:underline"
              >
                Drag {nounPhrase} here, or browse
              </button>
            </p>
            {/* Compact drops the spec line: it's advisory, and the caller's ⓘ hint carries the
                guidance in dense layouts. */}
            {!compact && hint != null && <p className="text-xs text-muted">{hint}</p>}
            {/* Padding, not font size: the target was a 10px-tall line of text inside a zone that
                now browses on click, so a near-miss opened a file dialog instead. The negative
                margin keeps it visually where it was while giving it a real hit area. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // must not also trigger the zone's browse
                setShowUrl((v) => !v);
              }}
              className="-mx-2 -my-1 rounded px-2 py-1 text-xs text-muted underline underline-offset-2 hover:text-foreground"
            >
              or paste {nounPhrase} URL
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {showUrl && !hasFile && (
        <div className="flex items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-field)] border border-border bg-surface-raised text-muted">
            {icon}
          </span>
          <input
            type="url"
            inputMode="url"
            aria-label={`${nounTitle} URL`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyUrl();
              }
            }}
            placeholder={placeholder}
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
