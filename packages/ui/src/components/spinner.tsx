import { Spinner as SpinnerIcon } from '../icons';
import { cn } from '../lib/cn';

/**
 * Spinner — inline loading indicator (button-busy, lazy sections). `label` names it
 * for assistive tech; pass an empty string when a nearby element already announces
 * the loading state.
 */

export type SpinnerSize = 'sm' | 'md' | 'lg';

const sizes: Record<SpinnerSize, string> = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-7',
};

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label = 'Loading…', className }: SpinnerProps) {
  return (
    <SpinnerIcon
      role="status"
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn('animate-spin text-muted', sizes[size], className)}
    />
  );
}
