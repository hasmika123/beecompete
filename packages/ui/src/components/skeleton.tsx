import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * Skeleton — a soft pulsing placeholder for loading content (listing cards, detail
 * panels). Size it with width/height utilities; defaults to a text-line height.
 * Decorative: hidden from assistive tech (wrap the region in aria-busy).
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('h-4 animate-pulse rounded-[var(--radius-field)] bg-surface', className)}
      {...props}
    />
  );
}
