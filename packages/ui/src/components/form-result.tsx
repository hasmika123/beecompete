'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Alert, type AlertTone } from './alert';
import { cn } from '../lib/cn';

export interface FormResultProps {
  /** True on success (green Alert), false on error. */
  ok: boolean;
  /** Message to show + announce. Falsy → renders nothing (e.g. the initial, un-submitted state). */
  message?: ReactNode;
  /** Tone for the error state (default 'danger'); some forms use 'info' for gentle inert copy. */
  errorTone?: Exclude<AlertTone, 'success'>;
  className?: string;
}

/**
 * The announced result of a form action. A role="status" Alert that mounts together with its
 * content is not reliably announced by screen readers, so this wraps it in a programmatically
 * focusable region and moves focus to it when the message appears — so keyboard/AT users actually
 * hear the outcome. Centralizes the success/error Alert shared by the capture / feedback /
 * correction forms.
 */
export function FormResult({ ok, message, errorTone = 'danger', className }: FormResultProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hasMessage = Boolean(message);
  useEffect(() => {
    // Focus when a result appears (or flips success↔error) — not on every render, so we don't
    // steal focus mid-typing.
    if (hasMessage) ref.current?.focus();
  }, [ok, hasMessage]);

  if (!hasMessage) return null;
  return (
    <div ref={ref} tabIndex={-1} className={cn('outline-none', className)}>
      <Alert tone={ok ? 'success' : errorTone}>{message}</Alert>
    </div>
  );
}
