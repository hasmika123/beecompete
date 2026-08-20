'use client';

import type { ReactNode } from 'react';
import { X, cn } from '@beecompete/ui';

/**
 * Shared chrome for the landing email-capture panels (#57): the gold-soft band, the centred
 * column, and the optional close affordance. The digest and host captures render their own
 * heading/copy/form inside it so the two can never drift apart visually.
 *
 * `onClose` is what makes a panel dismissible. It is OPTIONAL on purpose: the digest band is also
 * rendered standalone and always-visible on How It Works and Categories, where there is nothing to
 * close and no X should appear.
 *
 * When dismissible the panel is also focus-managed by its owner (see audience-section) — it takes
 * tabIndex={-1} so focus can be moved onto it after it opens, which is what stops a keyboard user
 * from being left at the trigger while new content appears further down the page.
 */
export function CapturePanel({
  id,
  headingId,
  onClose,
  closeLabel,
  children,
}: {
  id?: string;
  headingId: string;
  onClose?: () => void;
  closeLabel?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={onClose ? -1 : undefined}
      className={cn(
        'relative rounded-[var(--radius-panel)] border border-border bg-brand-gold-soft/60 p-6 sm:p-10',
        onClose &&
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel ?? 'Close'}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X aria-hidden="true" weight="bold" className="size-4" />
        </button>
      )}
      <div className="mx-auto grid max-w-4xl justify-items-center gap-3 text-center">
        {children}
      </div>
    </section>
  );
}
