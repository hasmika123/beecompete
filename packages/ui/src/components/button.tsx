import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * Pill button (design-brief §3, delegation 2026-07-08).
 *
 * Variants: `primary` = ink fill + white text (inverts in dark mode) · `brand` = gold
 * fill + ink text (standout CTAs — text on gold is always ink) · `secondary` = soft
 * surface + hairline border · `ghost` = bare. No glow/colored shadows anywhere.
 *
 * For link-shaped buttons use `buttonClasses()` on an `<a>`/`<Link>`.
 */

export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium select-none ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[1.1em] [&_svg]:shrink-0';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-85 active:opacity-75',
  brand: 'bg-brand-gold text-brand-ink hover:brightness-95 active:brightness-90',
  secondary: 'border border-border bg-surface text-foreground hover:bg-border/60 active:bg-border',
  ghost: 'text-foreground hover:bg-surface active:bg-border/60',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3.5 text-sm',
  md: 'h-9.5 px-4.5 text-sm',
  lg: 'h-10.5 px-5 text-base',
};

export function buttonClasses(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  const { variant = 'primary', size = 'md', className } = opts ?? {};
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
