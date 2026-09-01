import type { CompetitionCardData } from '@beecompete/ui';
import type { CompetitionSummary } from '@/lib/catalog-types';
import { calendarDaysUntil, formatDate, keyDateZone } from '@/lib/dates';
import { displayRegionName, isUsCountry, stateCode } from '@/lib/us-states';

// Display derivation for catalog data — the CompetitionCard is presentation-only, so the
// wording rules live here: grade encoding (Q2: Pre-K = −1, K = 0, 1–12), relative deadline
// inside a ~14-day window (blueprints decision #12) with the danger tint only in the final
// days (owner r8), and the region label. Server + client safe (no imports with side effects).

const COLLEGE_YEARS: Record<number, string> = {
  13: 'College freshman',
  14: 'College sophomore',
  15: 'College junior',
  16: 'College senior',
};

export function gradeName(grade: number): string {
  if (grade <= -1) return 'Pre-K';
  if (grade === 0) return 'K';
  // 13–16 are the four undergraduate years, 17+ is Graduate (owner 2026-08-24 — the single
  // "College" rung couldn't say whether a competition was freshman-only or open to all four).
  if (COLLEGE_YEARS[grade]) return COLLEGE_YEARS[grade];
  if (grade >= 17) return 'Graduate';
  return String(grade);
}

/** Whether a rung carries its own name ("College") instead of reading as "grade N". */
const namedLevel = (grade: number) => grade >= 13;

/** Dropdown label: "Grade 8" / "Grade K" for the school rungs, the bare name past them. */
export function gradeOptionLabel(grade: number): string {
  return namedLevel(grade) ? gradeName(grade) : `Grade ${gradeName(grade)}`;
}

/**
 * The full grade ladder Pre-K(-1) … 12, then the four college years (13–16) and Graduate (17) —
 * the Q2 encoding, post-high-school rungs activated 2026-08-23 and split into named
 * undergraduate years 2026-08-24. Single source shared by the marketplace grade filter and the
 * admin eligibility dropdowns, so both offer the identical choices.
 */
export const GRADE_VALUES: readonly number[] = Array.from({ length: 19 }, (_, i) => i - 1);

/**
 * "Grades 8–10" · "Grades K–5" · "Up to grade 8" · "Grade 9+" · undefined when open. The named
 * post-HS rungs drop the "grade" wording: "Grades 9–College freshman" · "College freshman+".
 */
export function gradeLabel(min: number | null, max: number | null): string | undefined {
  if (min == null && max == null) return undefined;
  if (min != null && max != null) {
    if (min === max) return namedLevel(min) ? gradeName(min) : `Grade ${gradeName(min)}`;
    return namedLevel(min)
      ? `${gradeName(min)}–${gradeName(max)}`
      : `Grades ${gradeName(min)}–${gradeName(max)}`;
  }
  if (max != null)
    return namedLevel(max) ? `Up to ${gradeName(max)}` : `Up to grade ${gradeName(max)}`;
  return namedLevel(min as number)
    ? `${gradeName(min as number)}+`
    : `Grade ${gradeName(min as number)}+`;
}

/** "13–18" · "Up to 18" · "13+" · undefined when no age range is on record. */
export function ageRangeLabel(min: number | null, max: number | null): string | undefined {
  if (min == null && max == null) return undefined;
  if (min != null && max != null) return `${min}–${max}`;
  return max != null ? `Up to ${max}` : `${min}+`;
}

export interface EligibilityFacts {
  eligibilityBasis: string | null;
  minGrade: number | null;
  maxGrade: number | null;
  minAge: number | null;
  maxAge: number | null;
}

/**
 * WHO MAY ENTER, as the organizer states it — the single derivation behind the card badge and the
 * At-a-glance strip (blueprints decision 99, owner 2026-08-28).
 *
 * `eligibility_basis` says which axis is STATED. The other axis, when populated, is a range we
 * derived for filtering, and it is deliberately NOT rendered here: a derived grade range is lossy
 * by construction (age 18 maps to grade 12 or 13), so showing it as the rule tells a 12-year-old in
 * grade 7 that they qualify for an ages-13+ competition. The Eligibility tab shows both, labeling
 * the derived one — this is the headline, and the headline has to be true.
 *
 * ⚠ NO "All grades" FALLBACK. It was the old behavior and it asserted a verified fact about who may
 * enter on every listing where nobody had recorded one. `undefined` means "not stated" and the
 * callers say exactly that; `OPEN` — the organizer stating there IS no restriction — is the only
 * value that reads as open to everyone.
 */
export function eligibilityLabel(c: EligibilityFacts): string | undefined {
  const grades = gradeLabel(c.minGrade, c.maxGrade);
  const ages = ageRangeLabel(c.minAge, c.maxAge);
  const agesWithUnit = ages ? `Ages ${ages}` : undefined;
  switch (c.eligibilityBasis) {
    case 'open':
      return 'Open to all ages';
    case 'age':
      return agesWithUnit;
    case 'grade':
      return grades;
    case 'both':
      // Both stated and independent ("grades 7–12, and age 13+"): neither one alone is the rule,
      // so the headline carries both rather than picking a winner.
      return [grades, agesWithUnit].filter(Boolean).join(' · ') || undefined;
    default:
      // Basis not recorded (legacy rows pre-0023, or a curator hasn't reached it). Fall back to
      // whatever IS on record rather than showing nothing — but never invent the other axis.
      return [grades, agesWithUnit].filter(Boolean).join(' · ') || undefined;
  }
}

const RELATIVE_WINDOW_DAYS = 14;
const URGENT_DAYS = 3;

export interface DeadlineDisplay {
  label: string;
  urgent: boolean;
}

/**
 * Factual urgency only — relative wording inside the window, absolute date beyond it.
 * Calendar-day math in the deadline's zone (review fixes H1/M6): a deadline later today is
 * "Closes today" (not "1 day to go"), and an already-passed instant renders nothing (the
 * strict `<` guard — no `Math.ceil(-0)` slipping urgent-red past a stale server value).
 */
export function deadlineDisplay(
  nextDeadline: string | null,
  now = new Date(),
  timeZone?: string | null,
): DeadlineDisplay | undefined {
  if (!nextDeadline) return undefined;
  if (new Date(nextDeadline).getTime() < now.getTime()) return undefined; // passed — say nothing
  const zone = keyDateZone(timeZone);
  const days = calendarDaysUntil(nextDeadline, now, zone);
  if (days <= RELATIVE_WINDOW_DAYS) {
    const label =
      days <= 0 ? 'Closes today' : days === 1 ? 'Closes tomorrow' : `${days} days to go`;
    return { label, urgent: days <= URGENT_DAYS };
  }
  return { label: `Closes ${formatDate(nextDeadline, zone)}`, urgent: false };
}

/**
 * "Texas" · "Austin, TX" · "Texas +2" · "Nationwide" · "Online" · undefined when untagged.
 *
 * #77 (supersedes #76's always-abbreviate): a state abbreviates ONLY beside a city —
 * "Austin, TX" — where the code is qualifying a longer label. A state standing alone keeps its
 * full name ("Texas"): a bare two-letter code next to Free/Paid read like a stray tag, and the
 * footer has the width.
 *
 * The US country tag is dropped (US-only catalog) — but only when another region survives it.
 * Tagged at country level ONLY is a real statement (not state-restricted) and renders
 * "Nationwide"; UNTAGGED is missing data and stays undefined. Those must not collapse.
 *
 * The DTO sends flat names with no level (see us-states.ts), so "city" here means any region that
 * is not a known state / the US tag / the virtual region. That heuristic is why the payload needs
 * level+code (sweep plan §12); this function then shrinks to composing from real levels.
 */
export function regionLabel(regions: string[]): string | undefined {
  if (regions.length === 0) return undefined;

  const named = regions.filter((r) => !isUsCountry(r)).map((r) => displayRegionName(r));
  if (named.length === 0) return 'Nationwide';

  const firstState = named.find((r) => stateCode(r) !== undefined);
  // "Online" (the virtual region) is not a city — a hybrid tagged virtual+state must not compose
  // into "Online, TX".
  const firstCity = named.find((r) => stateCode(r) === undefined && r !== 'Online');

  // City + state pair → "Austin, TX"; anything tagged beyond the pair is counted.
  if (firstCity !== undefined && firstState !== undefined) {
    const pair = `${firstCity}, ${stateCode(firstState)}`;
    const rest = named.length - 2;
    return rest > 0 ? `${pair} +${rest}` : pair;
  }

  // No pairing → first region under its full name ("Texas", "Austin", "Online"), rest counted.
  if (named.length === 1) return named[0];
  return `${named[0]} +${named.length - 1}`;
}

/** CompetitionSummary → the card's display props. Detail pages live at /c/<slug> (decision #30). */
export function toCardData(item: CompetitionSummary): CompetitionCardData {
  const deadline = deadlineDisplay(item.nextDeadline);
  return {
    name: item.name,
    href: `/c/${item.slug}`,
    categorySlug: item.category.slug,
    categoryName: item.category.name,
    coverUrl: item.logo ?? undefined,
    eligibilityLabel: eligibilityLabel(item),
    organizerName: item.organizer?.name,
    organizerVerified: item.organizer?.verificationState === 'verified',
    blurb: item.blurb ?? undefined,
    free: item.costType === 'free',
    regionLabel: regionLabel(item.regions),
    // "Bragging rights" when no prize is on record (sweep item 16) — the footer's bold prize slot
    // then always renders. A null prize is uncurated, not a guaranteed no-prize; curators fill in
    // a real prize where one exists.
    prizeLabel: item.prizeSummary ?? 'Bragging rights',
    deadlineLabel: deadline?.label,
    deadlineUrgent: deadline?.urgent,
  };
}

/**
 * Derived listing maintainer (R1-19): a competition is host-maintained when its organizer ORG
 * is claimed or verified; otherwise BeeCompete curates it. Competitions carry no trust state of
 * their own — this is the single source of that fact for cards + the detail trust panel.
 */
export function isHostMaintained(item: {
  organizer?: { verificationState: string } | null;
}): boolean {
  const s = item.organizer?.verificationState;
  return s === 'claimed' || s === 'verified';
}
