import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * EmptyState — the centered "nothing here (yet)" block: zero-results near-miss (R1-6),
 * empty tracker/articles later. Optional `icon`, a `title`, supporting `description`,
 * and an `action` slot (e.g. a Button or reset-filters link).
 */

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      {icon != null && (
        <span className="grid size-12 place-items-center rounded-full bg-surface text-muted [&_svg]:size-6">
          {icon}
        </span>
      )}
      <p className="font-display text-lg text-foreground">{title}</p>
      {description != null && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action != null && <div className="mt-1">{action}</div>}
    </div>
  );
}
