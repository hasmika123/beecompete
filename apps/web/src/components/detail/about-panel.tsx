import { Badge } from '@beecompete/ui';
import { Group } from '@/components/detail/definition-grid';
import { categoryAttributeRows } from '@/lib/detail-display';
import type { CompetitionDetail } from '@/lib/catalog-types';

// "About" tab — the OVERFLOW BIN (owner 2026-08-18, #106). The description moved out to the
// header, and this tab keeps its slot as the home for curated data with no designed place
// elsewhere:
//   {Category} details → the free-form JSONB attributes bag, humanized (moved off the Details
//                        tab, which now holds only the two designed groups: Eligibility and
//                        Format & judging)
//   Tags               → curator keywords; not filterable at R1, so they had no surface at all
// When a genuinely new field arrives and has nowhere to go, it lands HERE rather than being
// wedged into a designed group — that is the point of the tab. Promote fields out of it as they
// earn a real home.

/** Whether the tab has anything to show — the page omits the tab entirely when false. */
export function hasAboutData(competition: CompetitionDetail): boolean {
  return (
    categoryAttributeRows(competition.attributes).length > 0 || (competition.tags?.length ?? 0) > 0
  );
}

export function AboutPanel({ competition }: { competition: CompetitionDetail }) {
  const attributeRows = categoryAttributeRows(competition.attributes);
  const tags = competition.tags ?? [];

  return (
    <div className="grid gap-6">
      <Group title={`${competition.category.name} details`} rows={attributeRows} />
      {tags.length > 0 && (
        <div className="grid gap-3">
          {/* h2 for the same reason as Group's — first-level headings inside the main column. */}
          <h2 className="text-sm font-semibold text-foreground">Tags</h2>
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <Badge variant="outline">{tag}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
