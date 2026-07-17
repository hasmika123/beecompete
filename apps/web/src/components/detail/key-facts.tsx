import { gradeLabel } from '@/lib/catalog-display';
import {
  costLabel,
  currentEdition,
  deliveryLabel,
  evaluationLabel,
  participationLabel,
  pathwayLabel,
  recurrenceLabel,
} from '@/lib/detail-display';
import type { CompetitionDetail } from '@/lib/catalog-types';

// "Key Facts & Details" tab (blueprints Page 3.3a): the standardized Spine layout, identical
// across every competition, plus the category-specific attributes rendered from the JSONB bag.
// The bag has no per-template field labels wired at R1, so keys are humanized generically;
// template-driven labels are a later refinement.

interface Row {
  label: string;
  value: string;
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function renderValue(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) {
    const parts = value.map(renderValue).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return null; // skip nested objects at R1
  return String(value);
}

function spineRows(competition: CompetitionDetail): Row[] {
  const edition = currentEdition(competition.editions);
  const rows: Row[] = [
    {
      label: 'Grades',
      value: gradeLabel(competition.minGrade, competition.maxGrade) ?? 'All grades',
    },
  ];
  if (competition.minAge != null || competition.maxAge != null) {
    const { minAge, maxAge } = competition;
    const ageValue =
      minAge != null && maxAge != null
        ? `${minAge}–${maxAge}`
        : maxAge != null
          ? `Up to ${maxAge}`
          : `${minAge}+`;
    rows.push({ label: 'Age', value: ageValue });
  }
  rows.push(
    { label: 'Format', value: participationLabel(competition.participationMode) },
    { label: 'How to enter', value: pathwayLabel(competition.entryPathway) },
    { label: 'Delivery', value: deliveryLabel(competition.delivery) },
    { label: 'Cost', value: costLabel(competition, edition) },
    { label: 'Recurrence', value: recurrenceLabel(competition.recurrence) },
  );
  if (
    (competition.participationMode === 'team' || competition.participationMode === 'both') &&
    (competition.teamSizeMin != null || competition.teamSizeMax != null)
  ) {
    const { teamSizeMin, teamSizeMax } = competition;
    const teamValue =
      teamSizeMin != null && teamSizeMax != null
        ? `${teamSizeMin}–${teamSizeMax} members`
        : teamSizeMax != null
          ? `Up to ${teamSizeMax} members`
          : `${teamSizeMin}+ members`;
    rows.push({ label: 'Team size', value: teamValue });
  }
  if (competition.evaluationType && competition.evaluationType.length > 0) {
    rows.push({
      label: 'Evaluation',
      value: competition.evaluationType.map(evaluationLabel).join(', '),
    });
  }
  return rows;
}

function DefinitionGrid({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4 border-b border-border/60 pb-2">
          <dt className="text-sm text-muted">{row.label}</dt>
          <dd className="text-right text-sm font-medium text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function KeyFacts({ competition }: { competition: CompetitionDetail }) {
  const attributeRows: Row[] = Object.entries(competition.attributes ?? {})
    .map(([key, value]) => ({ label: humanizeKey(key), value: renderValue(value) }))
    .filter((r): r is Row => r.value != null);

  return (
    <div className="grid gap-6">
      <DefinitionGrid rows={spineRows(competition)} />
      {attributeRows.length > 0 && (
        <div className="grid gap-3">
          {/* h2 (not h3): this is the first heading in the main column after the page h1, and its
              sibling sections (Prep resources, Related, Key dates) are h2 — an h3 here skips a
              level (WCAG 1.3.1). Level is independent of the small visual size. */}
          <h2 className="text-sm font-semibold text-foreground">
            {competition.category.name} details
          </h2>
          <DefinitionGrid rows={attributeRows} />
        </div>
      )}
    </div>
  );
}
