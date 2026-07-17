import type { ReactNode } from 'react';
import { Card, CardContent, CardTitle, ChevronDown } from '@beecompete/ui';

/**
 * A Card whose body collapses under its title — a native <details>/<summary> accordion (no JS,
 * SSR-friendly, same pattern as the detail-page FAQ list). Collapsed by default so a long admin
 * page (e.g. /admin/landing) opens tidy; pass `defaultOpen` to start expanded. The body stays in
 * the DOM while collapsed, so client forms inside keep hydrating and submitting normally.
 */
export function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <details className="group" open={defaultOpen}>
        {/* list-none + the webkit variant hide the default disclosure triangle. */}
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
          <CardTitle>{title}</CardTitle>
          <ChevronDown
            aria-hidden="true"
            className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
          />
        </summary>
        <CardContent className="pt-0">{children}</CardContent>
      </details>
    </Card>
  );
}
