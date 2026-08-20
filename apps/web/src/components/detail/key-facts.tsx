import { Group } from '@/components/detail/definition-grid';
import {
  ELIGIBILITY_ATTR_LABELS,
  ageLabel,
  currentEdition,
  evaluationLabel,
  pathwayLabel,
  recurrenceLabel,
  renderAttrValue,
} from '@/lib/detail-display';
import type { AttrRow } from '@/lib/detail-display';
import type { CompetitionDetail } from '@/lib/catalog-types';

// "Details" tab (blueprints Page 3.3a, regrouped by #82, trimmed by #106): two DESIGNED
// sub-sections —
//   Eligibility        → who may enter: age (+ cutoff), entry pathway, and the standard
//                        eligibility JSONB keys (citizenship etc., domain-model 2026-07-08)
//   Format & judging   → team size, evaluation, recurrence
// The free-form "{Category} details" attribute dump moved to the About tab (#106), which is the
// overflow bin now — this tab holds only groups we actually designed. The row helpers and the
// eligibility key list live in lib/detail-display (both tabs read the bag).
// Grades/Cost/Format/Delivery are deliberately ABSENT (owner #81/#82) — they live in the
// At-a-glance strip, which owns the scan. "How to enter" appears here under Eligibility AND at
// the Register button (#82): pathway is both an eligibility fact and a decision-point fact —
// that is the approved, deliberate repetition.

function eligibilityRows(competition: CompetitionDetail): AttrRow[] {
  const edition = currentEdition(competition.editions);
  const rows: AttrRow[] = [];
  const age = ageLabel(competition, edition);
  if (age) rows.push({ label: 'Age', value: age });
  rows.push({ label: 'How to enter', value: pathwayLabel(competition.entryPathway) });
  for (const [key, label] of Object.entries(ELIGIBILITY_ATTR_LABELS)) {
    const value = renderAttrValue(competition.attributes?.[key]);
    if (value != null) rows.push({ label, value });
  }
  return rows;
}

function formatRows(competition: CompetitionDetail): AttrRow[] {
  const rows: AttrRow[] = [];
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
  rows.push({ label: 'Recurrence', value: recurrenceLabel(competition.recurrence) });
  return rows;
}

export function KeyFacts({ competition }: { competition: CompetitionDetail }) {
  return (
    <div className="grid gap-6">
      <Group title="Eligibility" rows={eligibilityRows(competition)} />
      <Group title="Format & judging" rows={formatRows(competition)} />
    </div>
  );
}
