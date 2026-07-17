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
    'aria-required'?: boolean;
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

  // The label must point at the control's REAL id — a consumer-supplied id would
  // otherwise orphan the label. Consumer aria-describedby is appended to, not clobbered.
  const controlId = children.props.id ?? id;
  const describedBy =
    [children.props['aria-describedby'], hasMessage ? describedById : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error != null ? true : children.props['aria-invalid'],
        // The visual `*` is aria-hidden, so convey the requirement programmatically too
        // (WCAG 3.3.2 / 1.3.1). Respects an explicit aria-required already on the control.
        'aria-required': required || children.props['aria-required'] || undefined,
      })
    : children;

  const LabelTag = labelAsText ? 'span' : 'label';

  return (
    // content-start: in a multi-column parent grid, CSS stretches every field in a row to the
    // tallest sibling's height; without this the hint-less fields absorb that extra height into
    // their rows and their control drifts ~11px below a hinted neighbor's. Packing rows to the
    // top keeps the control at a predictable offset so a row of mixed hinted/unhinted fields
    // aligns. No effect on single-column stacks (nothing stretches them).
    <div className={cn('grid content-start gap-1.5', className)}>
      <LabelTag
        {...(labelAsText ? {} : { htmlFor: controlId })}
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
        // role="alert" on the error so it's announced if it appears while focus is elsewhere
        // (WCAG 4.1.3). Hints carry no role. It's still wired to the control via aria-describedby.
        <p
          id={describedById}
          role={error != null ? 'alert' : undefined}
          className={cn('text-xs', error != null ? 'text-danger' : 'text-muted')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
