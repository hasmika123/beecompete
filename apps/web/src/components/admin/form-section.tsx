import type { ReactNode } from 'react';
import { cn } from '@beecompete/ui';

/**
 * Titled, evenly-spaced group with a top rule — gives long admin forms a scannable structure
 * instead of one undifferentiated column of fields. `cols` takes the grid-cols classes for the
 * field grid (e.g. "sm:grid-cols-3").
 */
export function FormSection({
  title,
  description,
  cols,
  children,
}: {
  title: string;
  description?: string;
  cols?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 className="font-display text-base text-foreground">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      <div className={cn('grid gap-4', cols)}>{children}</div>
    </section>
  );
}
