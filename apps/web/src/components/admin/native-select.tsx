import type { SelectHTMLAttributes } from 'react';
import { cn } from '@beecompete/ui';

// Native <select> for admin forms — unlike the design-system Select (controlled, no hidden
// input), this posts its value with FormData for server actions, and is keyboard-accessible for
// free. Styled to match the Input primitive. Works as a FormField child (accepts id/aria props).
export interface NativeSelectOption {
  value: string;
  label: string;
}

export interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: NativeSelectOption[];
  placeholder?: string;
}

const fieldBase =
  'w-full rounded-[var(--radius-field)] border border-border bg-background px-3.5 h-10 text-sm text-foreground ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'aria-invalid:border-danger disabled:opacity-60';

export function NativeSelect({ options, placeholder, className, ...props }: NativeSelectProps) {
  return (
    <select className={cn(fieldBase, className)} {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Title-case an enum token for display: SCHOOL_OR_CHAPTER → "School or chapter". */
export function enumLabel(token: string): string {
  const lower = token.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function enumOptions(tokens: readonly string[]): NativeSelectOption[] {
  return tokens.map((t) => ({ value: t, label: enumLabel(t) }));
}
