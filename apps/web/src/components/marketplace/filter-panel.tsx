'use client';

import { useId, useState } from 'react';
import { ChevronDown, Radio, RadioGroup, Select, cn } from '@beecompete/ui';
import { gradeName } from '@/lib/catalog-display';
import type { SearchFacets, RegionOption } from '@/lib/catalog-types';
import {
  DEADLINE_WINDOWS,
  marketplaceHref,
  type MarketplaceParams,
} from '@/lib/marketplace-params';

// Page-2 filter panel — facet order per decision #10 (owner): Grade → Category →
// State/Region → Deadline window → Cost → Format (individual/team) → Entry pathway →
// Delivery. Per-option counts on Grade + Category ONLY (decision #10/#13).
//
// Instant-apply (A10): each control change navigates immediately via `onNavigate` — no Apply
// button. Every filter state is still a canonical, shareable GET-param URL (marketplaceHref);
// the chips/quick-chips remain real links, so crawlability is unchanged. Reset lives on the
// tags row ("Clear all"), not here.
//
// Dropdowns are the design-system `Select` (custom listbox), NOT a native <select>: a native
// popup is OS-rendered and can't match the universal dropdown styling (owner 2026-07-13).
// Instant-apply means no FormData plumbing is lost, and each options list leads with an
// explicit clear entry ("Any …") since a custom listbox has no blank state to re-pick.

const GRADES = Array.from({ length: 14 }, (_, i) => i - 1); // Pre-K(-1) … 12

interface FilterPanelProps {
  path: string;
  params: MarketplaceParams;
  facets: SearchFacets | null;
  regions: RegionOption[];
  /** Category radios only render on /competitions — hub pages are locked to their category. */
  categoryFilter?: { active?: string };
  /** Navigate to a new filter URL (lifted to the frame so it can show a pending state). */
  onNavigate: (href: string) => void;
}

// Collapsible facet section — its own open state (persists across instant-apply re-renders).
// Opens by default for the first facet + any facet whose filter is currently active, so an
// applied filter is never hidden behind a fold.
function Facet({
  legend,
  defaultOpen,
  children,
}: {
  legend: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="min-w-0 border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold text-foreground">{legend}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div id={id} className="mt-3 min-w-0">
          {children}
        </div>
      )}
    </div>
  );
}

export function FilterPanel({
  path,
  params,
  facets,
  regions,
  categoryFilter,
  onNavigate,
}: FilterPanelProps) {
  const set = (patch: Partial<Record<keyof MarketplaceParams, string | number | undefined>>) =>
    onNavigate(marketplaceHref(path, params, patch));

  const gradeCount = (grade: number) => facets?.grades.find((g) => g.grade === grade)?.count;
  const gradeOptions = GRADES.map((grade) => {
    const count = gradeCount(grade);
    return {
      value: String(grade),
      label: `Grade ${gradeName(grade)}${count !== undefined ? ` (${count})` : ''}`,
    };
  });

  return (
    <div className="grid gap-3" aria-label="Filters">
      <Facet legend="Grade" defaultOpen>
        {/* Plain <div> wrappers, not <label>: the Select trigger is a button, so it takes an
            explicit aria-label instead (a wrapping label isn't a reliable accessible name for
            a combobox in Chromium anyway). */}
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1 text-xs text-muted">
            From
            <Select
              aria-label="Minimum grade"
              value={params.minGrade !== undefined ? String(params.minGrade) : ''}
              options={[{ value: '', label: 'Any' }, ...gradeOptions]}
              onValueChange={(v) => set({ minGrade: v || undefined })}
            />
          </div>
          <div className="grid gap-1 text-xs text-muted">
            To
            <Select
              aria-label="Maximum grade"
              value={params.maxGrade !== undefined ? String(params.maxGrade) : ''}
              options={[{ value: '', label: 'Any' }, ...gradeOptions]}
              onValueChange={(v) => set({ maxGrade: v || undefined })}
            />
          </div>
        </div>
      </Facet>

      {categoryFilter && (
        <Facet legend="Category" defaultOpen={!!categoryFilter.active}>
          <RadioGroup
            className="grid gap-1.5"
            value={categoryFilter.active ?? ''}
            onValueChange={(v) => set({ category: v || undefined })}
          >
            <Radio value="" label="All categories" />
            {(facets?.categories ?? []).map((c) => (
              <Radio key={c.slug} value={c.slug} label={`${c.name} (${c.count})`} />
            ))}
          </RadioGroup>
        </Facet>
      )}

      {regions.length > 0 && (
        <Facet legend="State / Region" defaultOpen={!!params.region}>
          <Select
            aria-label="Region"
            value={params.region ?? ''}
            options={[
              { value: '', label: 'Anywhere' },
              ...regions.map((r) => ({
                value: r.code ?? r.id,
                label: `${r.name} (${r.count})`,
              })),
            ]}
            onValueChange={(v) => set({ region: v || undefined })}
          />
        </Facet>
      )}

      <Facet legend="Deadline" defaultOpen={params.deadlineWithinDays !== undefined}>
        <RadioGroup
          className="grid gap-1.5"
          value={params.deadlineWithinDays !== undefined ? String(params.deadlineWithinDays) : ''}
          onValueChange={(v) => set({ deadlineWithinDays: v || undefined })}
        >
          <Radio value="" label="Any time" />
          {DEADLINE_WINDOWS.map((w) => (
            <Radio key={w.value} value={String(w.value)} label={w.label} />
          ))}
        </RadioGroup>
      </Facet>

      <Facet legend="Cost" defaultOpen={!!params.cost}>
        <RadioGroup
          className="grid gap-1.5"
          value={params.cost ?? ''}
          onValueChange={(v) => set({ cost: v || undefined })}
        >
          <Radio value="" label="Any" />
          <Radio value="free" label="Free" />
          <Radio value="paid" label="Paid" />
        </RadioGroup>
      </Facet>

      <Facet legend="Individual or team" defaultOpen={!!params.participation}>
        <RadioGroup
          className="grid gap-1.5"
          value={params.participation ?? ''}
          onValueChange={(v) => set({ participation: v || undefined })}
        >
          <Radio value="" label="Any" />
          <Radio value="individual" label="Individual" />
          <Radio value="team" label="Team" />
        </RadioGroup>
      </Facet>

      <Facet legend="Entry pathway" defaultOpen={!!params.pathway}>
        <RadioGroup
          className="grid gap-1.5"
          value={params.pathway ?? ''}
          onValueChange={(v) => set({ pathway: v || undefined })}
        >
          <Radio value="" label="Any" />
          <Radio value="individual" label="Enter on your own" />
          <Radio value="school_or_chapter" label="Through a school or chapter" />
        </RadioGroup>
      </Facet>

      <Facet legend="Delivery" defaultOpen={!!params.delivery}>
        <RadioGroup
          className="grid gap-1.5"
          value={params.delivery ?? ''}
          onValueChange={(v) => set({ delivery: v || undefined })}
        >
          <Radio value="" label="Any" />
          <Radio value="in_person" label="In person" />
          <Radio value="virtual" label="Virtual" />
          <Radio value="hybrid" label="Hybrid" />
        </RadioGroup>
      </Facet>
    </div>
  );
}
