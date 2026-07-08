import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * Text field primitives — rounded (12px), hairline border, ink focus ring, soft
 * invalid state via `aria-invalid`. Labels/help text are the consumer's job
 * (pair with <label htmlFor>).
 */

const fieldBase =
  'w-full rounded-[var(--radius-field)] border border-border bg-background px-3.5 text-foreground ' +
  'placeholder:text-muted transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ' +
  'disabled:pointer-events-none disabled:opacity-45 ' +
  'aria-invalid:border-danger aria-invalid:focus-visible:outline-danger';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(fieldBase, 'h-10 text-sm', className)} {...props} />;
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn(fieldBase, 'min-h-24 py-2.5 text-sm', className)} {...props} />;
}
