import type { SelectHTMLAttributes } from 'react';
import { ChevronDown, cn } from '@beecompete/ui';

// Native <select> for admin + filter forms — unlike the design-system Select (controlled, no
// hidden input), this posts its value with FormData / GET forms, and is keyboard-accessible for
// free. `appearance-none` + our own chevron give it the SAME trigger look as the design-system
// Select (native popups can't be themed, but the closed control now matches). Works as a
// FormField child (accepts id/aria props). The caller's className lands on the wrapper (so width
// utilities like `w-40` size the whole control and keep the chevron aligned); the <select> always
// fills it.
export interface NativeSelectOption {
  value: string;
  label: string;
}

export interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: NativeSelectOption[];
  placeholder?: string;
}

const fieldBase =
  'h-10 w-full appearance-none rounded-[var(--radius-field)] border border-border bg-background pr-9 pl-3.5 text-sm text-foreground ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'aria-invalid:border-danger disabled:opacity-60';

export function NativeSelect({ options, placeholder, className, ...props }: NativeSelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select className={fieldBase} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
      />
    </div>
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
