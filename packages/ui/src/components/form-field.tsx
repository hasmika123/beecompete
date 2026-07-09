'use client';

import { cloneElement, isValidElement, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * FormField — the label + control + hint/error scaffold every form repeats. Wires the
 * control's id, aria-describedby, and aria-invalid automatically, so consumers only
 * pass the raw control (Input/Select/Textarea/Checkbox/RadioGroup). Shows the error in
 * place of the hint when present.
 */

export interface FormFieldProps {
  label: ReactNode;
  children: ReactElement<{
    id?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }>;
  hint?: ReactNode;
  error?: ReactNode;
  /** Set for checkbox/radio groups the label shouldn't point at a single input. */
  labelAsText?: boolean;
  required?: boolean;
  className?: string;
}

export function FormField({
  label,
  children,
  hint,
  error,
  labelAsText = false,
  required = false,
  className,
}: FormFieldProps) {
  const id = useId();
  const describedById = `${id}-desc`;
  const hasMessage = error != null || hint != null;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? id,
        'aria-describedby': hasMessage ? describedById : children.props['aria-describedby'],
        'aria-invalid': error != null ? true : children.props['aria-invalid'],
      })
    : children;

  const LabelTag = labelAsText ? 'span' : 'label';

  return (
    <div className={cn('grid gap-1.5', className)}>
      <LabelTag
        {...(labelAsText ? {} : { htmlFor: id })}
        className="text-sm font-medium text-foreground"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger">
            {' '}
            *
          </span>
        )}
      </LabelTag>
      {control}
      {hasMessage && (
        <p
          id={describedById}
          className={cn('text-xs', error != null ? 'text-danger' : 'text-muted')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
