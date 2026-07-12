'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, cn } from '@beecompete/ui';
import type { ButtonVariant } from '@beecompete/ui';

// Present-but-honest R1 stub for the two sidebar conversion CTAs whose capture backends land
// later — "Follow this competition" (email follow → M29, built at R1-15b) and "Claim this
// competition" (host-interest → H46, R1-15b). The button is real and prominent (the blueprint
// calls Follow the page's conversion event); clicking reveals an honest inline note instead of
// silently doing nothing. Swapped for the real capture at R1-15b.

interface StubActionProps {
  label: string;
  /** A rendered icon element (server components can't hand a component *type* across the
   * client boundary, but an element is fine). */
  icon: ReactNode;
  variant: ButtonVariant;
  /** Honest explanation shown once clicked. */
  note: ReactNode;
}

export function StubAction({ label, icon, variant, note }: StubActionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button
        variant={variant}
        className="w-full justify-center"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        {label}
      </Button>
      {open && (
        <p
          className={cn(
            'mt-2 rounded-[var(--radius-field)] border border-border bg-surface px-3 py-2',
            'text-xs leading-relaxed text-muted',
          )}
          role="status"
        >
          {note}
        </p>
      )}
    </div>
  );
}
