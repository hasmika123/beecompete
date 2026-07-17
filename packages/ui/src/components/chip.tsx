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
  const shape = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors',
    selected
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border bg-surface-raised text-foreground',
    className,
  );

  // Removable mode (active-filter tag): a static container holding the label + a REAL remove
  // button. Never nest an interactive control inside a <button> — it's invalid content and the
  // inner control isn't reliably keyboard-operable or exposed to AT (WCAG 2.1.1 / 4.1.2).
  if (onRemove) {
    return (
      <span className={shape}>
        {children}
        <button
          type="button"
          aria-label={removeLabel}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-1 grid size-4 place-items-center rounded-full text-current/70 hover:text-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X aria-hidden="true" weight="bold" className="size-3" />
        </button>
      </span>
    );
  }

  // Toggle mode: the whole chip is the button.
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        shape,
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45',
        !selected && 'hover:bg-surface',
      )}
      {...props}
    >
      {children}
    </button>
  );
}
