import type { HTMLAttributes, ReactNode } from 'react';
import { CheckCircle, CircleAlert, Info, Warning } from '../icons';
import { cn } from '../lib/cn';

/**
 * Alert — an inline callout for status/context: beta disclaimer (R1-13), affiliate
 * disclosure (R1-8), form-level errors, compliance notices. `tone` sets color +
 * default icon; pass `title` for a heading, children for the body.
 *
 * For a full-width page-top strip (the app-wide beta banner) use `<Alert flush>`.
 */

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'bg-surface text-foreground',
    icon: <Info aria-hidden="true" className="size-4.5 text-muted" />,
  },
  success: {
    box: 'bg-success-soft text-foreground',
    icon: <CheckCircle aria-hidden="true" weight="fill" className="size-4.5 text-success" />,
  },
  warning: {
    box: 'bg-brand-gold-soft text-foreground',
    icon: <Warning aria-hidden="true" className="size-4.5 text-foreground" />,
  },
  danger: {
    box: 'bg-danger-soft text-foreground',
    icon: <CircleAlert aria-hidden="true" className="size-4.5 text-danger" />,
  },
};

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: AlertTone;
  title?: ReactNode;
  icon?: ReactNode;
  /** Square edges + no border, for a full-bleed page-top banner. */
  flush?: boolean;
}

export function Alert({
  tone = 'info',
  title,
  icon,
  flush = false,
  className,
  children,
  ...props
}: AlertProps) {
  const t = tones[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 text-sm',
        flush ? 'px-4 py-2.5 sm:px-6' : 'rounded-[var(--radius-panel)] border border-border p-4',
        t.box,
        className,
      )}
      {...props}
    >
      <span className="mt-px shrink-0">{icon ?? t.icon}</span>
      <div className="min-w-0 flex-1">
        {title != null && <p className="font-semibold">{title}</p>}
        {children != null && (
          <div className={cn(title != null && 'mt-0.5 text-muted')}>{children}</div>
        )}
      </div>
    </div>
  );
}
