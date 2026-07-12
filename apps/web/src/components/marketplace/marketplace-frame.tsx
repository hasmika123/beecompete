'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Filter, Input, Search, Select, X, cn } from '@beecompete/ui';
import { marketplaceHref, SORTS, type MarketplaceParams } from '@/lib/marketplace-params';

// Page-2 toolbar + filter-panel chrome (client): search · sort · Filter toggle · live count.
// The panel itself is a server-rendered GET form passed in as a node; this component only
// owns visibility — desktop side panel (grid reflows via container queries) and the mobile
// bottom sheet (blueprint Page 2 mobile note).

interface MarketplaceFrameProps {
  path: string;
  params: MarketplaceParams;
  total: number;
  panel: ReactNode;
  /** Chips + quick-chips rows (server-rendered). */
  chips?: ReactNode;
  quickChips: ReactNode;
  children: ReactNode;
}

export function MarketplaceFrame({
  path,
  params,
  total,
  panel,
  chips,
  quickChips,
  children,
}: MarketplaceFrameProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const sortValue = params.sort ?? (params.q ? 'relevance' : 'name');
  const sortOptions = SORTS.filter((s) => s.value !== 'relevance' || !!params.q);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <form action={path} method="get" role="search" className="relative min-w-0 flex-1 basis-64">
          {/* Preserve active filters when searching. */}
          {Object.entries({
            sort: params.sort,
            minGrade: params.minGrade,
            maxGrade: params.maxGrade,
            region: params.region,
            cost: params.cost,
            delivery: params.delivery,
            participation: params.participation,
            pathway: params.pathway,
            deadlineWithinDays: params.deadlineWithinDays,
          }).map(([key, value]) =>
            value !== undefined ? (
              <input key={key} type="hidden" name={key} value={String(value)} />
            ) : null,
          )}
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search competitions…"
            aria-label="Search competitions"
            className="pl-10"
          />
        </form>

        <Select
          aria-label="Sort"
          value={sortValue}
          onValueChange={(sort) => router.push(marketplaceHref(path, params, { sort }))}
          options={sortOptions.map((s) => ({ value: s.value, label: s.label }))}
          className="w-44"
        />

        <Button
          variant={open ? 'primary' : 'secondary'}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="marketplace-filters"
        >
          <Filter aria-hidden="true" className="size-4" /> Filter
        </Button>

        <span className="text-sm text-muted" aria-live="polite">
          {total} competition{total === 1 ? '' : 's'}
        </span>
      </div>

      {chips}
      {quickChips}

      <div className="flex items-start gap-6">
        {open && (
          <aside
            id="marketplace-filters"
            className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] w-64 shrink-0 overflow-y-auto pr-1 lg:block"
          >
            {panel}
          </aside>
        )}
        {/* Container queries reflow the card grid 4-per-row ↔ 3-per-row when the panel opens. */}
        <div className="min-w-0 flex-1 @container">{children}</div>
      </div>

      {/* Mobile: the panel is a bottom sheet behind the Filter button. */}
      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto',
              'rounded-t-[var(--radius-panel)] border-t border-border bg-background p-5 pb-8',
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg text-foreground">Filters</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
            {panel}
          </div>
        </div>
      )}
    </div>
  );
}
