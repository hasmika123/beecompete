import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { X } from '@phosphor-icons/react/dist/ssr';
import { cn } from '../lib/cn';

/**
 * Chip — an INTERACTIVE pill (vs Badge, which is a static label). Two modes:
 *  - toggle: grade quick-chips, filter facets — `selected` drives the active look.
 *  - removable: active-filter tags — pass `onRemove` for a trailing ✕.
 * Renders a <button> so it's keyboard-operable.
 */

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  selected?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
}

export function Chip({
  selected = false,
  onRemove,
  removeLabel = 'Remove',
  className,
  children,
  type = 'button',
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={onRemove ? undefined : selected}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-surface-raised text-foreground hover:bg-surface',
        className,
      )}
      {...props}
    >
      {children}
      {onRemove && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={removeLabel}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-1 grid size-4 place-items-center rounded-full text-current/70 hover:text-current"
        >
          <X aria-hidden="true" weight="bold" className="size-3" />
        </span>
      )}
    </button>
  );
}
