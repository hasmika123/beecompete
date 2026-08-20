'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Bell, X, buttonClasses, cn } from '@beecompete/ui';

/**
 * Follow disclosure (owner 2026-08-18): the follow email-capture panel is hidden until the
 * "Follow this competition" button is pressed, and closes again via its own ✕.
 *
 * The trigger (breadcrumb row + mobile sticky bar) and the panel (top of the right rail, above
 * the cover image) sit in different branches of the tree, so the open state lives in a context
 * that wraps the whole article. The page itself stays a server component — only the trigger,
 * the panel shell, and the capture form are client-side.
 */
const FollowContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

function useFollow(component: string) {
  const ctx = useContext(FollowContext);
  if (!ctx) throw new Error(`${component} must be rendered inside <FollowProvider>`);
  return ctx;
}

export function FollowProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <FollowContext.Provider value={{ open, setOpen }}>{children}</FollowContext.Provider>;
}

/**
 * The trigger, in the breadcrumb row (#86). Toggles, so a second press closes the panel it just
 * opened.
 *
 * The call site hides this whole group below sm (owner 2026-08-19) — phones get Follow from the
 * sticky bottom bar and nowhere else — so this is simply the labelled pill at every width it is
 * actually rendered at. The explicit `aria-label` is kept even though the visible text now always
 * matches it: it pins the accessible name if the label is ever shortened again.
 */
export function FollowTrigger() {
  const { open, setOpen } = useFollow('FollowTrigger');
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="follow-cta"
      aria-label="Follow this competition"
      onClick={() => setOpen(!open)}
      className={buttonClasses({ variant: 'secondary', size: 'sm' })}
    >
      <Bell aria-hidden="true" className="size-4" />
      Follow this competition
    </button>
  );
}

/** Opens the panel from anywhere else (the mobile sticky bar). */
export function useFollowOpener() {
  const { setOpen } = useFollow('useFollowOpener');
  return () => setOpen(true);
}

/**
 * The panel itself — rendered only while open, directly under the trigger and above the cover
 * image box. The capture form inside autofocuses its input on mount, which is what carries the
 * viewport (and screen-reader focus) here when the mobile sticky bar opens it.
 */
export function FollowPanel({ children, className }: { children: ReactNode; className?: string }) {
  const { open, setOpen } = useFollow('FollowPanel');
  return (
    // The wrapper is always in the DOM (hidden while closed) so both triggers' aria-controls
    // resolve to a real element; `hidden` also drops it out of the rail grid, so it costs no gap.
    // The CONTENTS mount only while open — the capture form's autoFocus must fire on each open.
    <div
      id="follow-cta"
      hidden={!open}
      className={cn(
        'relative scroll-mt-24 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-4',
        className,
      )}
    >
      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-3 right-3 grid size-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
          <div className="pr-8">{children}</div>
        </>
      )}
    </div>
  );
}
