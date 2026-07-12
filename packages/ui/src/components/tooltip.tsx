'use client';

import { cloneElement, isValidElement, useId, useState } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * Tooltip — a short hint on hover/focus (verified-badge explainer, help icons,
 * truncated text). CSS-only positioning (top|bottom); for rich/interactive overlays
 * use a Popover instead. The trigger must be focusable for keyboard + AT access.
 *
 * A11y: the trigger is cloned with `aria-describedby` pointing at the tooltip (screen
 * readers announce it on focus), and Escape dismisses while it's open (WCAG 1.4.13).
 */

export interface TooltipProps {
  content: ReactNode;
  side?: 'top' | 'bottom';
  children: ReactElement<{ 'aria-describedby'?: string }>;
  className?: string;
}

export function Tooltip({ content, side = 'top', children, className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  // Associate trigger ↔ tooltip. While hidden, the reference is ignored by AT; once
  // visible (hover/focus) it's announced.
  const trigger = isValidElement(children)
    ? cloneElement(children, { 'aria-describedby': id })
    : children;

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Escape' && open) setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
      onKeyDown={onKeyDown}
    >
      {trigger}
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 w-max max-w-56 -translate-x-1/2 rounded-[10px] bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-popover)]',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
