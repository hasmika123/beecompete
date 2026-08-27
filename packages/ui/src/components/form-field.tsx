'use client';

import { cloneElement, isValidElement, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Info } from '../icons';
import { cn } from '../lib/cn';
import { Tooltip } from './tooltip';

/**
 * FormField — the label + control + hint/error scaffold every form repeats. Wires the
 * control's id, aria-describedby, and aria-invalid automatically, so consumers only
 * pass the raw control (Input/Select/Textarea/Checkbox/RadioGroup). Shows the error in
 * place of the hint when present.
 *
 * `hintAs="icon"` moves the hint off the page into an ⓘ beside the label — for dense forms
 * (the admin create/import wizard) where a paragraph under every control buries the controls
 * themselves. ERRORS never move: they stay inline and visible, because a message you must act
 * on cannot live behind a hover. The hint also stays in the accessibility tree on the control
 * itself (visually hidden, still `aria-describedby`), so screen-reader users hear it when they
 * reach the field rather than having to find the icon.
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
  /** Where the hint reads: under the control (default) or in an ⓘ tooltip beside the label. */
  hintAs?: 'text' | 'icon';
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
  hintAs = 'text',
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

  // The ⓘ only earns its place when there's a hint to show and it isn't already being displaced
  // by an error. Named from the label when that's plain text, so several icons in one step don't
  // all announce as the same anonymous "more information" button.
  const showHintIcon = hintAs === 'icon' && hint != null;
  const hintIconLabel = typeof label === 'string' ? `More about ${label}` : 'More information';

  const labelEl = (
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
  );

  return (
    // content-start: in a multi-column parent grid, CSS stretches every field in a row to the
    // tallest sibling's height; without this the hint-less fields absorb that extra height into
    // their rows and their control drifts ~11px below a hinted neighbor's. Packing rows to the
    // top keeps the control at a predictable offset so a row of mixed hinted/unhinted fields
    // aligns. No effect on single-column stacks (nothing stretches them).
    <div className={cn('grid content-start gap-1.5', className)}>
      {showHintIcon ? (
        // The trigger sits OUTSIDE the label element: a button nested in a <label> would also
        // activate the control on click.
        <span className="flex items-center gap-1.5">
          {labelEl}
          <Tooltip content={hint}>
            <button
              type="button"
              aria-label={hintIconLabel}
              className="inline-flex rounded-full text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              <Info aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
        </span>
      ) : (
        labelEl
      )}
      {control}
      {hasMessage && (
        // role="alert" on the error so it's announced if it appears while focus is elsewhere
        // (WCAG 4.1.3). Hints carry no role. It's still wired to the control via aria-describedby.
        // In icon mode a hint stays in the DOM but sr-only — the ⓘ is the sighted affordance, and
        // this keeps the control's own accessible description intact.
        <p
          id={describedById}
          role={error != null ? 'alert' : undefined}
          className={cn(
            'text-xs',
            error != null ? 'text-danger' : showHintIcon ? 'sr-only' : 'text-muted',
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
