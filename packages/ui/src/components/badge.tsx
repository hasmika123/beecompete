import type { HTMLAttributes } from 'react';
import { SealCheck } from '@phosphor-icons/react/dist/ssr';
import { cn } from '../lib/cn';

/**
 * Badge — rounded-full tinted chip. Variants per design-brief §4: `verified` =
 * subtle green ✓ on soft green tint · `neutral` (Curated) = quiet neutral ·
 * `gold` = brand tint (text on gold tints is always ink-dark) · `success` = the
 * verified tint WITHOUT the seal (a positive state that isn't a verification claim).
 *
 * `size="action"` matches a `sm` Button's box (h-8 / px-3.5 / text-sm) so a badge can sit in a
 * row of action buttons without reading as a different scale — owner 2026-08-24, the detail
 * page's status tag beside Follow/Share.
 */

export type BadgeVariant = 'neutral' | 'gold' | 'verified' | 'success' | 'outline' | 'danger';
export type BadgeSize = 'default' | 'action';

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-surface text-muted',
  gold: 'bg-brand-gold-soft text-foreground',
  verified: 'bg-success-soft text-success',
  success: 'bg-success-soft text-success',
  outline: 'border border-border text-muted',
  danger: 'bg-danger-soft text-danger',
};

const sizes: Record<BadgeSize, string> = {
  default: 'px-2.5 py-0.5 text-xs',
  action: 'h-8 px-3.5 text-sm',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

export function Badge({
  variant = 'neutral',
  size = 'default',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    >
      {variant === 'verified' && (
        <SealCheck aria-hidden="true" weight="fill" className="size-3.5" />
      )}
      {children}
    </span>
  );
}
