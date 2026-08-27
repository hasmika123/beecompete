import type { ReactNode } from 'react';
import { Info, Tooltip, cn } from '@beecompete/ui';

/**
 * Titled, evenly-spaced group with a top rule — gives long admin forms a scannable structure
 * instead of one undifferentiated column of fields. `cols` takes the grid-cols classes for the
 * field grid (e.g. "sm:grid-cols-3"). `hint` renders as an ⓘ beside the title (the FormField
 * icon-hint pattern at section level) — for context worth having but not worth a paragraph.
 */
export function FormSection({
  title,
  description,
  hint,
  cols,
  children,
}: {
  title: string;
  description?: string;
  hint?: string;
  cols?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div>
        <span className="flex items-center gap-1.5">
          <h2 className="font-display text-base text-foreground">{title}</h2>
          {hint && (
            <Tooltip content={hint}>
              <button
                type="button"
                aria-label={`More about ${title}`}
                className="inline-flex rounded-full text-muted transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:outline-none"
              >
                <Info aria-hidden="true" className="size-4" />
              </button>
            </Tooltip>
          )}
        </span>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      <div className={cn('grid gap-4', cols)}>{children}</div>
    </section>
  );
}

/**
 * The same title + ⓘ pairing one level down: an h3 for the named parts INSIDE a step (the
 * Custom fields tab's three sections). Split out rather than duplicated a third time — the
 * tooltip trigger's markup and focus ring already existed here and in FormField.
 *
 * Section context lives in the ⓘ rather than a paragraph under the heading (owner 2026-08-24):
 * three stacked explanations pushed the actual fields below the fold on the tab where the
 * curator is least sure what to type.
 */
export function SubSectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint && (
        <Tooltip content={hint}>
          <button
            type="button"
            aria-label={`More about ${title}`}
            className="inline-flex rounded-full text-muted transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:outline-none"
          >
            <Info aria-hidden="true" className="size-4" />
          </button>
        </Tooltip>
      )}
    </span>
  );
}
