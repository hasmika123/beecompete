import { Info } from '@beecompete/ui';
import { DetailLedger } from '@/components/detail/detail-ledger';
import { categoryAttributeRows } from '@/lib/detail-display';
import type { CompetitionDetail } from '@/lib/catalog-types';

// The OVERFLOW BIN (owner 2026-08-18, #106; folded into Overview by #87; back out as its own
// "More" tab by #108). The description lives in the header; this section is the home for curated
// data with no designed place elsewhere:
//   {Category} details → the free-form JSONB attributes bag, humanized — everything the
//                        Eligibility, Judging and Logistics tabs did not claim
// When a genuinely new field arrives and has nowhere to go, it lands HERE rather than being
// wedged into a designed group — that is the point of the tab. Promote fields out of it as they
// earn a real home: contact_email/contact_phone left for Logistics (#108), and TAGS left for the
// page header (owner 2026-08-26) — see tag-row.tsx. The bin is now attributes only, so a listing
// whose only extra data was tags no longer shows the tab at all.
//
// ⚠ Named "More", not "Details": #87 retired the "Details" tab when it split into Eligibility +
// Judging, so reusing that label would resurrect a dead name with different contents.

/** Whether the tab has anything to show — the page omits the tab entirely when false. */
export function hasMoreData(competition: CompetitionDetail): boolean {
  return categoryAttributeRows(competition.attributes).length > 0;
}

export function MorePanel({ competition }: { competition: CompetitionDetail }) {
  // ONE COLUMN, ALWAYS (owner 2026-08-27, #112): these are arbitrary Category Template keys
  // holding free text, so nothing bounds their length and nothing here may claim the `compact`
  // two-up treatment.
  //
  // ONE GENERIC ICON for every row (owner, #114; glyph simplified #115). #112 left this tab
  // icon-free on the grounds that no glyph could mean anything specific enough per key — true,
  // but it made More the one tab whose rows started at a different left edge. A single repeated
  // Info is the plainest marker available: a circle and a stroke, reading as "a further detail"
  // without claiming to describe which. (Tag was the first attempt and looked too much like a
  // label/keyword affordance, which these are not — the tags on this page live in the header.)
  // ⚠ Repetition is the POINT — do not try to map keys to glyphs, since the key set is
  // open-ended and per-category.
  const rows = categoryAttributeRows(competition.attributes);
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-3">
      {/* No visible heading (owner 2026-08-27, #113) — the tab strip already says "More", and a
          "{Category} details" title above five rows was chrome restating it. The accessible name
          stays for screen readers, matching the other tabs' sr-only headings. */}
      <h2 className="sr-only">{`${competition.category.name} details`}</h2>
      <DetailLedger
        items={rows.map((row) => ({
          key: row.label,
          icon: Info,
          label: row.label,
          value: row.value,
        }))}
      />
    </div>
  );
}
