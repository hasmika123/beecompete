'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Filter, Input, Search, Select, X, cn } from '@beecompete/ui';
import type { RegionOption, SearchFacets } from '@/lib/catalog-types';
import { marketplaceHref, SORTS, type MarketplaceParams } from '@/lib/marketplace-params';
import { FilterPanel } from './filter-panel';

// Page-2 toolbar + filter-panel chrome (client): search · sort · Filter toggle · live count.
// Owns filter navigation (A10 instant-apply) — each panel change routes here and shows a
// pending state on the results while the new page streams in. Desktop = a side panel exactly
// one card track wide (--card-w) that sticks at the BOTTOM edge (no internal scroll; the page
// grows); mobile = a bottom sheet with a "Show N" button.

interface MarketplaceFrameProps {
  path: string;
  params: MarketplaceParams;
  total: number;
  facets: SearchFacets | null;
  regions: RegionOption[];
  categoryFilter?: { active?: string };
  /** Removable-tags row (server-rendered, incl. the "Clear all" link). */
  chips?: ReactNode;
  quickChips: ReactNode;
  children: ReactNode;
}

export function MarketplaceFrame({
  path,
  params,
  total,
  facets,
  regions,
  categoryFilter,
  chips,
  quickChips,
  children,
}: MarketplaceFrameProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const sortValue = params.sort ?? (params.q ? 'relevance' : 'name');
  const sortOptions = SORTS.filter((s) => s.value !== 'relevance' || !!params.q);

  // Bottom-edge stickiness (owner 2026-07-13, blueprints #36): the panel is NEVER pinned at
  // the top. When it's taller than the viewport it scrolls with the page and pins only when
  // its BOTTOM touches the viewport bottom — sticky pins when the element's top hits `top`,
  // so `top = 100dvh − panelHeight − margin` makes that moment exactly "bottom at viewport
  // bottom". When it's SHORTER than the viewport that formula would displace it downward at
  // rest (a sticky top inset acts immediately, bottom-docking it under a hole), so short
  // panels stay in normal flow and simply scroll with the page. The height changes as facets
  // expand, so a ResizeObserver + resize listener keep the measurement fresh; the aside
  // mounts only while `open`, so the effect's lifetime tracks it via the [open] dep.
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      el.style.setProperty('--panel-h', `${h}px`);
      // Sticky only when the pin line (100dvh − h − 24) sits at/above the header band (80px),
      // i.e. the panel roughly overfills the viewport — that's when bottom-pinning is
      // geometrically meaningful and can never displace the panel at rest.
      el.style.position = h >= window.innerHeight - 104 ? '' : 'static';
    };
    // Measure synchronously at mount — the observer's FIRST delivery rides the frame loop,
    // which can be starved (backgrounded/embedded tabs).
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  // Instant-apply navigation with a pending transition — one RSC fetch per change (same cost
  // as an Apply click), and `pending` dims the results while it lands.
  const navigate = (href: string) => startTransition(() => router.push(href, { scroll: false }));

  const filterPanel = (
    <FilterPanel
      path={path}
      params={params}
      facets={facets}
      regions={regions}
      categoryFilter={categoryFilter}
      onNavigate={navigate}
    />
  );

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
          onValueChange={(sort) => navigate(marketplaceHref(path, params, { sort }))}
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
          // No internal scroll (owner): the panel sits in normal flow and the PAGE grows;
          // facets are collapsed by default so it stays short. w-(--card-w) = exactly one card
          // track, which is what keeps the card width invariant to the toggle. The sticky top
          // offset implements bottom-edge pinning for taller-than-viewport panels (see the
          // measure effect above — it switches short panels to static so they never pin).
          <aside
            ref={asideRef}
            id="marketplace-filters"
            className="sticky top-[calc(100dvh-var(--panel-h,100dvh)-1.5rem)] hidden w-(--card-w) shrink-0 self-start lg:block"
          >
            {filterPanel}
          </aside>
        )}
        {/* Fixed --card-w tracks mean the card width is invariant to the panel opening. */}
        <div
          className={cn(
            'min-w-0 flex-1 transition-opacity',
            pending && 'pointer-events-none opacity-60',
          )}
          aria-busy={pending}
        >
          {children}
        </div>
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
              'scrollbar-slim absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col overflow-y-auto',
              'rounded-t-[var(--radius-panel)] border-t border-border bg-background p-5 pb-4',
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
            {filterPanel}
            {/* Live count IS the feedback loop that replaces Apply — it updates as you pick. */}
            <div className="sticky bottom-0 -mx-5 mt-4 border-t border-border bg-background px-5 pt-3">
              <Button className="w-full" onClick={() => setOpen(false)}>
                Show {total} competition{total === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
