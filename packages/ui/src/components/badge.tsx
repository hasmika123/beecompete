import type { HTMLAttributes } from 'react';
import { BadgeCheck } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Badge — rounded-full tinted chip. Variants per design-brief §4: `verified` =
 * subtle green ✓ on soft green tint · `neutral` (Curated) = quiet neutral ·
 * `gold` = brand tint (text on gold tints is always ink-dark).
 */

export type BadgeVariant = 'neutral' | 'gold' | 'verified' | 'outline' | 'danger';

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-surface text-muted',
  gold: 'bg-brand-gold-soft text-foreground',
  verified: 'bg-success-soft text-success',
  outline: 'border border-border text-muted',
  danger: 'bg-danger-soft text-danger',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[variant],
        className,
      )}
      {...props}
    >
      {variant === 'verified' && <BadgeCheck aria-hidden="true" className="size-3.5" />}
      {children}
    </span>
  );
}
