'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { CheckCircle, CircleAlert, Info, X } from '../icons';
import { cn } from '../lib/cn';

/**
 * Toast — transient action feedback (saved, shared, submitted, error). Mount
 * <ToastProvider> once near the app root, then call useToast().toast(...) anywhere.
 * Toasts render in an aria-live region (polite; assertive for errors) and auto-dismiss.
 */

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** ms before auto-dismiss; 0 keeps it until dismissed. Default 4500. */
  duration?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used inside <ToastProvider>');
  return ctx;
}

const toneIcon: Record<ToastTone, ReactNode> = {
  info: <Info aria-hidden="true" className="size-5 text-muted" />,
  success: <CheckCircle aria-hidden="true" weight="fill" className="size-5 text-success" />,
  error: <CircleAlert aria-hidden="true" className="size-5 text-danger" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      counter.current += 1;
      const id = counter.current;
      const duration = opts.duration ?? 4500;
      setToasts((prev) => [...prev, { ...opts, id }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          // The PERSISTENT live region is this always-mounted container — live regions
          // inserted together with their content (per-toast) are unreliably announced.
          // Errors additionally carry role="alert" for assertive announcement.
          <div
            aria-live="polite"
            aria-relevant="additions"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                role={t.tone === 'error' ? 'alert' : 'status'}
                className={cn(
                  'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-3.5 shadow-[var(--shadow-popover)]',
                )}
              >
                <span className="mt-px shrink-0">{toneIcon[t.tone ?? 'info']}</span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-foreground">{t.title}</p>
                  {t.description != null && <p className="mt-0.5 text-muted">{t.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="-mt-0.5 -mr-0.5 grid size-6 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
