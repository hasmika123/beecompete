import {
  Calendar,
  FilePdf,
  Flag,
  Globe,
  GraduationCap,
  Info,
  ListIcon,
  Scales,
  Star,
  Ticket,
  User,
} from '@beecompete/ui';
import { DetailLedger, type LedgerItem } from '@/components/detail/detail-ledger';
import {
  ELIGIBILITY_ATTR_LABELS,
  JUDGING_ATTR_LABELS,
  RULES_URL_ATTR,
  ageLabel,
  currentEdition,
  displayUrl,
  evaluationLabel,
  pathwayLabel,
  renderAttrValue,
  studentStatusLabel,
} from '@/lib/detail-display';
import { gradeLabel } from '@/lib/catalog-display';
import type { CompetitionDetail } from '@/lib/catalog-types';

// Eligibility + Judging tab panels (blueprints Page 3.3a, retabbed by #87 — the old "Details"
// tab's two groups promoted to tabs of their own; both moved onto the shared DetailLedger by
// #112, so every tab except FAQ now reads in one register):
//   Eligibility → who may enter: grades (REPEATED from the At-a-glance strip on purpose — the
//                 strip lives on the Overview tab and isn't visible from here), age (+ cutoff),
//                 entry pathway, and the standard eligibility JSONB keys.
//                 ⚠ TEAM SIZE IS NOT HERE (owner 2026-08-26, #108): it moved to the Logistics
//                 tab, which mirrors the admin form's `administration` step — and that step
//                 took participation + team size off its own Eligibility step on 2026-08-24.
//   Judging     → how entries are assessed: evaluation types + the judging catalog-info keys
//                 (judging_criteria / tie_breakers / rules_url, 2026-08-22 template additions).
//                 ⚠ Catalog INFO about competitions we don't run — the judging SYSTEM
//                 (H12–H17/H25) stays gated behind its Phase-3 deep-dive.
//
// COMPACT (two-up) covers fields whose value is bounded by an enum or a short numeric range —
// grades / age / how-to-enter / student-status — PLUS the two country fields, which pair with
// each other by owner request (#113) because they are the same kind of fact and invite comparison.
// The prose catch-all stays full width, as does everything on Judging: every one of its values is
// prose or an unbounded list.

/**
 * Which axis, if either, is OURS rather than the organizer's. `BOTH` and `OPEN` are stated in full,
 * and a null basis (legacy rows, or nothing recorded yet) claims nothing either way — in all three
 * cases nothing is marked approximate, because we cannot honestly say which one we derived.
 */
function derivedAxis(basis: string | null): 'grade' | 'age' | null {
  if (basis === 'age') return 'grade';
  if (basis === 'grade') return 'age';
  return null;
}

function eligibilityRows(competition: CompetitionDetail): LedgerItem[] {
  const edition = currentEdition(competition.editions);
  const rows: LedgerItem[] = [];
  // BOTH axes render here — this tab is where the full picture belongs, and it is the one place
  // a reader can see how the two relate. Since blueprints decision 99, the axis the organizer did
  // NOT state is marked as ours: a grade range derived from an age rule is a search aid, and
  // labeling it "Approx." is what keeps this tab from repeating the claim the strip stopped making.
  const derived = derivedAxis(competition.eligibilityBasis);
  const grades = gradeLabel(competition.minGrade, competition.maxGrade);
  if (grades)
    rows.push({
      key: 'grades',
      icon: GraduationCap,
      label: derived === 'grade' ? 'Grades (approx.)' : 'Grades',
      value: derived === 'grade' ? `${grades} — the organizer states ages` : grades,
      compact: true,
    });
  const age = ageLabel(competition, edition);
  if (age)
    rows.push({
      key: 'age',
      icon: Calendar,
      label: derived === 'age' ? 'Age (approx.)' : 'Age',
      value: derived === 'age' ? `${age} — the organizer states grades` : age,
      compact: true,
    });
  rows.push({
    key: 'pathway',
    icon: Ticket,
    label: 'How to enter',
    value: pathwayLabel(competition.entryPathway),
    compact: true,
  });
  const studentStatus = studentStatusLabel(competition.attributes?.student_status_required);
  if (studentStatus != null) {
    rows.push({
      key: 'student_status_required',
      icon: User,
      label: ELIGIBILITY_ATTR_LABELS.student_status_required!,
      value: studentStatus,
      compact: true,
    });
  }
  // The two country fields pair with each other (owner 2026-08-27, #113) — they are the same
  // kind of fact and read best compared side by side. They are the one COMPACT exception to the
  // bounded-value rule: a country list is technically unbounded, so a long one wraps to more
  // lines inside its half column rather than truncating. That is the accepted trade for the
  // comparison; if a listing ever ships a dozen countries, this is the pair to revisit.
  const countryKeys: [string, typeof Globe][] = [
    ['eligible_countries', Globe],
    ['citizenship_countries', Flag],
  ];
  for (const [key, icon] of countryKeys) {
    const value = renderAttrValue(competition.attributes?.[key]);
    if (value != null) {
      rows.push({ key, icon, label: ELIGIBILITY_ATTR_LABELS[key]!, value, compact: true });
    }
  }
  // The prose catch-all always takes the full width.
  const other = renderAttrValue(competition.attributes?.other_eligibility_requirements);
  if (other != null) {
    rows.push({
      key: 'other_eligibility_requirements',
      icon: Info,
      label: ELIGIBILITY_ATTR_LABELS.other_eligibility_requirements!,
      value: other,
    });
  }
  return rows;
}

export function EligibilityPanel({ competition }: { competition: CompetitionDetail }) {
  return (
    <div className="grid gap-3">
      <h2 className="sr-only">Eligibility</h2>
      <DetailLedger items={eligibilityRows(competition)} />
    </div>
  );
}

/** The untrusted-JSONB rule: a non-string (or non-http) rules_url is simply "no link". */
function rulesUrl(competition: CompetitionDetail): string | null {
  const value = competition.attributes?.[RULES_URL_ATTR];
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim()) ? value.trim() : null;
}

function judgingRows(competition: CompetitionDetail): LedgerItem[] {
  const rows: LedgerItem[] = [];
  if (competition.evaluationType && competition.evaluationType.length > 0) {
    rows.push({
      key: 'evaluation',
      icon: ListIcon,
      label: 'Evaluation',
      value: competition.evaluationType.map(evaluationLabel).join(', '),
    });
  }
  // Star = what judges reward; Scales = how a tie is weighed. Distinct glyphs, and neither
  // repeats the ListIcon above them.
  const icons: Record<string, typeof Star> = { judging_criteria: Star, tie_breakers: Scales };
  for (const [key, label] of Object.entries(JUDGING_ATTR_LABELS)) {
    const value = renderAttrValue(competition.attributes?.[key]);
    if (value != null) rows.push({ key, icon: icons[key] ?? Star, label, value });
  }
  const url = rulesUrl(competition);
  if (url) {
    rows.push({
      key: 'rules_url',
      icon: FilePdf,
      label: 'Official rules',
      value: (
        <a
          href={url}
          target="_blank"
          rel="noreferrer nofollow"
          className="inline-flex max-w-full items-baseline gap-1.5 underline underline-offset-2 hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="min-w-0 truncate">{displayUrl(url)}</span>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ),
    });
  }
  return rows;
}

/** Whether the Judging tab has anything to show — the page omits the tab entirely when false. */
export function hasJudgingData(competition: CompetitionDetail): boolean {
  return judgingRows(competition).length > 0;
}

export function JudgingPanel({ competition }: { competition: CompetitionDetail }) {
  return (
    <div className="grid gap-3">
      <h2 className="sr-only">Judging</h2>
      <DetailLedger items={judgingRows(competition)} />
    </div>
  );
}
