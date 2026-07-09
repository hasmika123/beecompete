import type { InputHTMLAttributes, ReactNode } from 'react';
import { Check } from '@phosphor-icons/react/dist/ssr';
import { cn } from '../lib/cn';

/**
 * Checkbox — native input (keeps focus/keyboard/form semantics) with a styled box.
 * Optional `label` renders an inline, clickable label. Filters, wizard, admin.
 */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

export function Checkbox({ label, className, disabled, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 text-sm text-foreground select-none',
        disabled ? 'opacity-45' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          disabled={disabled}
          className="peer size-4.5 appearance-none rounded-[6px] border border-border bg-background transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          {...props}
        />
        <Check
          aria-hidden="true"
          weight="bold"
          className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
        />
      </span>
      {label != null && <span>{label}</span>}
    </label>
  );
}
