'use client';

import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { Modal } from './modal';
import { cn } from '../lib/cn';

/**
 * useConfirm — a promise-based confirmation dialog for irreversible/destructive admin actions
 * (archive, reject, remove). Returns `confirm(opts) => Promise<boolean>` and a `dialog` node the
 * caller renders once. Usage:
 *
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   onClick={async () => { if (await confirm({ title: 'Archive?', tone: 'danger' })) doIt(); }}
 *   ...
 *   return (<>{dialog}{buttons}</>);
 */
export interface ConfirmOptions {
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

export function useConfirm(): {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  const dialog = (
    <Modal
      open={opts !== null}
      onClose={() => settle(false)}
      title={opts?.title ?? ''}
      description={opts?.message}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => settle(false)}>
            {opts?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className={cn(opts?.tone === 'danger' && 'bg-danger text-white hover:opacity-85')}
            onClick={() => settle(true)}
          >
            {opts?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      }
    />
  );

  return { confirm, dialog };
}
