'use client';

import { createContext, useContext, useId } from 'react';
import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * RadioGroup + Radio — a set of mutually exclusive options. The group owns the shared
 * name + selected value (controlled via `onValueChange`); each Radio reads it from
 * context. Digest preferences, wizard steps, admin. Pairs with FormField.
 */

interface RadioGroupContextValue {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  name?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function RadioGroup({
  name,
  value,
  onValueChange,
  className,
  children,
  ...props
}: RadioGroupProps) {
  const generatedName = useId();
  return (
    <div role="radiogroup" className={cn('grid gap-2', className)} {...props}>
      <RadioGroupContext.Provider value={{ name: name ?? generatedName, value, onValueChange }}>
        {children}
      </RadioGroupContext.Provider>
    </div>
  );
}

export interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'name'
> {
  value: string;
  label?: ReactNode;
}

export function Radio({ value, label, className, disabled, ...props }: RadioProps) {
  const ctx = useContext(RadioGroupContext);
  const checked = ctx?.value !== undefined ? ctx.value === value : undefined;

  return (
    <label
      className={cn(
        // `flex` (not inline-flex) so a radio row fills its column and the label text can
        // wrap instead of forcing the container wider — long options in a narrow filter
        // panel were spilling and giving the panel its own horizontal scrollbar.
        'flex items-start gap-2 text-sm text-foreground select-none',
        disabled ? 'opacity-45' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative inline-flex shrink-0">
        <input
          type="radio"
          name={ctx?.name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={() => ctx?.onValueChange?.(value)}
          className="peer size-4.5 appearance-none rounded-full border border-border bg-background transition-colors checked:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          {...props}
        />
        <span className="pointer-events-none absolute inset-0 m-auto size-2 rounded-full bg-primary opacity-0 peer-checked:opacity-100" />
      </span>
      {label != null && <span className="min-w-0">{label}</span>}
    </label>
  );
}
