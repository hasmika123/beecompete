import Link from 'next/link';
import { Button, Radio, RadioGroup, buttonClasses } from '@beecompete/ui';
import { NativeSelect } from '@/components/admin/native-select';
import { gradeName } from '@/lib/catalog-display';
import type { SearchFacets, RegionOption } from '@/lib/catalog-types';
import { DEADLINE_WINDOWS, type MarketplaceParams } from '@/lib/marketplace-params';

// Page-2 filter panel — facet order per decision #10 (owner): Grade → Category →
// State/Region → Deadline window → Cost → Format (individual/team) → Entry pathway →
// Delivery. Per-option counts on Grade + Category ONLY (decision #10/#13). A plain GET form:
// every filter state is a crawlable, shareable URL; no client state to lose.

const GRADES = Array.from({ length: 14 }, (_, i) => i - 1); // Pre-K(-1) … 12

interface FilterPanelProps {
  path: string;
  params: MarketplaceParams;
  facets: SearchFacets | null;
  regions: RegionOption[];
  /** Category radios only render on /competitions — hub pages are locked to their category. */
  categoryFilter?: { active?: string };
}

function Facet({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-border pt-4">
      <legend className="float-left mb-2 w-full text-sm font-semibold text-foreground">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

export function FilterPanel({ path, params, facets, regions, categoryFilter }: FilterPanelProps) {
  const gradeCount = (grade: number) => facets?.grades.find((g) => g.grade === grade)?.count;
  const gradeOptions = GRADES.map((grade) => {
    const count = gradeCount(grade);
    return {
      value: String(grade),
      label: `Grade ${gradeName(grade)}${count !== undefined ? ` (${count})` : ''}`,
    };
  });

  return (
    <form method="get" action={path} className="grid gap-4" aria-label="Filters">
      {/* Preserve non-facet state across an Apply. */}
      {params.q && <input type="hidden" name="q" value={params.q} />}
      {params.sort && <input type="hidden" name="sort" value={params.sort} />}

      <Facet legend="Grade">
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-muted">
            From
            <NativeSelect
              name="minGrade"
              // Explicit label — both selects otherwise expose only "Any" to AT (the wrapping
              // label text isn't reliably taken as the accessible name in Chromium).
              aria-label="Minimum grade"
              defaultValue={params.minGrade !== undefined ? String(params.minGrade) : ''}
              placeholder="Any"
              options={gradeOptions}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            To
            <NativeSelect
              name="maxGrade"
              aria-label="Maximum grade"
              defaultValue={params.maxGrade !== undefined ? String(params.maxGrade) : ''}
              placeholder="Any"
              options={gradeOptions}
            />
          </label>
        </div>
      </Facet>

      {categoryFilter && (
        <Facet legend="Category">
          <RadioGroup name="category" className="grid gap-1.5">
            <Radio value="" label="All categories" defaultChecked={!categoryFilter.active} />
            {(facets?.categories ?? []).map((c) => (
              <Radio
                key={c.slug}
                value={c.slug}
                label={`${c.name} (${c.count})`}
                defaultChecked={categoryFilter.active === c.slug}
              />
            ))}
          </RadioGroup>
        </Facet>
      )}

      {regions.length > 0 && (
        <Facet legend="State / Region">
          <NativeSelect
            name="region"
            aria-label="Region"
            defaultValue={params.region ?? ''}
            placeholder="Anywhere"
            options={regions.map((r) => ({
              value: r.code ?? r.id,
              label: `${r.name} (${r.count})`,
            }))}
          />
        </Facet>
      )}

      <Facet legend="Deadline">
        <RadioGroup name="deadlineWithinDays" className="grid gap-1.5">
          <Radio
            value=""
            label="Any time"
            defaultChecked={params.deadlineWithinDays === undefined}
          />
          {DEADLINE_WINDOWS.map((w) => (
            <Radio
              key={w.value}
              value={String(w.value)}
              label={w.label}
              defaultChecked={params.deadlineWithinDays === w.value}
            />
          ))}
        </RadioGroup>
      </Facet>

      <Facet legend="Cost">
        <RadioGroup name="cost" className="grid gap-1.5">
          <Radio value="" label="Any" defaultChecked={!params.cost} />
          <Radio value="free" label="Free" defaultChecked={params.cost === 'free'} />
          <Radio value="paid" label="Paid" defaultChecked={params.cost === 'paid'} />
        </RadioGroup>
      </Facet>

      <Facet legend="Individual or team">
        <RadioGroup name="participation" className="grid gap-1.5">
          <Radio value="" label="Any" defaultChecked={!params.participation} />
          <Radio
            value="individual"
            label="Individual"
            defaultChecked={params.participation === 'individual'}
          />
          <Radio value="team" label="Team" defaultChecked={params.participation === 'team'} />
        </RadioGroup>
      </Facet>

      <Facet legend="Entry pathway">
        <RadioGroup name="pathway" className="grid gap-1.5">
          <Radio value="" label="Any" defaultChecked={!params.pathway} />
          <Radio
            value="individual"
            label="Enter on your own"
            defaultChecked={params.pathway === 'individual'}
          />
          <Radio
            value="school_or_chapter"
            label="Through a school or chapter"
            defaultChecked={params.pathway === 'school_or_chapter'}
          />
        </RadioGroup>
      </Facet>

      <Facet legend="Delivery">
        <RadioGroup name="delivery" className="grid gap-1.5">
          <Radio value="" label="Any" defaultChecked={!params.delivery} />
          <Radio
            value="in_person"
            label="In person"
            defaultChecked={params.delivery === 'in_person'}
          />
          <Radio value="virtual" label="Virtual" defaultChecked={params.delivery === 'virtual'} />
          <Radio value="hybrid" label="Hybrid" defaultChecked={params.delivery === 'hybrid'} />
        </RadioGroup>
      </Facet>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        <Link href={path} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
          Reset
        </Link>
      </div>
    </form>
  );
}
