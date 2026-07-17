'use client';

import { Check } from '../icons';
import { cn } from '../lib/cn';

/**
 * Stepper — a vertical, freely-navigable step rail (not a forced wizard). Presentational: the
 * caller owns the active step and what "complete" means. A step can flag an unfilled required
 * field so the rail nudges without blocking navigation. Nodes read done (check) / current (gold)
 * / to-do (number), threaded by a continuous connector rail; the whole row is a button so
 * keyboard + click both select the step.
 */

export interface StepperStep {
  id: string;
  label: string;
  /** Short meta under the label, e.g. "Name · slug · category". */
  description?: string;
  /** Marks the step visited/valid — shows a check when it isn't the active step. */
  complete?: boolean;
  /** The step still holds an unfilled required field — shows a "required" flag. */
  incompleteRequired?: boolean;
}

export interface StepperProps {
  steps: StepperStep[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
  'aria-label'?: string;
}

export function Stepper({
  steps,
  activeId,
  onSelect,
  className,
  'aria-label': ariaLabel = 'Form steps',
}: StepperProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'flex flex-col rounded-[var(--radius-panel)] border border-border bg-surface-raised p-2',
        className,
      )}
    >
      {steps.map((step, i) => {
        const current = step.id === activeId;
        const showCheck = step.complete && !current;
        const isFirst = i === 0;
        const isLast = i === steps.length - 1;
        return (
          <button
            key={step.id}
            type="button"
            aria-current={current ? 'step' : undefined}
            onClick={() => onSelect(step.id)}
            className={cn(
              'group relative grid grid-cols-[28px_1fr] items-center gap-3 rounded-xl px-2.5 py-3 text-left transition-colors',
              current ? 'bg-background' : 'hover:bg-background/50',
            )}
          >
            {/* Continuous connector rail — a full-height hairline behind the nodes; each solid
                node masks the middle, leaving the segments above/below to read as one thread.
                Trimmed to the node centre on the first and last rows. */}
            {steps.length > 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-[23px] w-0.5 -translate-x-1/2 bg-border',
                  isFirst ? 'top-1/2 bottom-0' : isLast ? 'top-0 bottom-1/2' : 'inset-y-0',
                )}
              />
            )}
            {/* Active gold spine. */}
            {current && (
              <span
                aria-hidden="true"
                className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-brand-gold"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 flex size-[26px] items-center justify-center rounded-full border-[1.5px] text-xs font-semibold transition-colors',
                showCheck
                  ? 'border-success bg-success text-white'
                  : current
                    ? 'border-brand-gold bg-surface-raised text-foreground ring-4 ring-brand-gold/15'
                    : 'border-border bg-surface-raised text-muted group-hover:border-border-strong',
              )}
            >
              {showCheck ? <Check weight="bold" className="size-3.5" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'truncate text-sm font-medium',
                    current ? 'text-foreground' : 'text-foreground/90',
                  )}
                >
                  {step.label}
                </span>
                {step.incompleteRequired && (
                  // role="img" so the aria-label is exposed (AT ignores aria-label on a bare,
                  // role-less span) — gives the amber dot a text alternative so the state isn't
                  // conveyed by color alone (WCAG 1.1.1 / 1.4.1).
                  <span
                    role="img"
                    aria-label="has a required field"
                    className="size-1.5 shrink-0 rounded-full bg-amber-500"
                  />
                )}
              </span>
              {step.description && (
                <span className="mt-0.5 block truncate text-xs text-muted">{step.description}</span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
