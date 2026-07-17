import type { CompetitionCardData } from '@beecompete/ui';
import type { CompetitionSummary } from '@/lib/catalog-types';
import { calendarDaysUntil, formatDate } from '@/lib/dates';

// Display derivation for catalog data — the CompetitionCard is presentation-only, so the
// wording rules live here: grade encoding (Q2: Pre-K = −1, K = 0, 1–12), relative deadline
// inside a ~14-day window (blueprints decision #12) with the danger tint only in the final
// days (owner r8), and the region label. Server + client safe (no imports with side effects).

export function gradeName(grade: number): string {
  if (grade <= -1) return 'Pre-K';
  if (grade === 0) return 'K';
  return String(grade);
}

/**
 * The full grade ladder Pre-K(-1) … 12 (Q2 encoding). Single source shared by the marketplace
 * grade filter and the admin eligibility dropdowns, so both offer the identical grade choices.
 */
export const GRADE_VALUES: readonly number[] = Array.from({ length: 14 }, (_, i) => i - 1);

/** "Grades 8–10" · "Grades K–5" · "Up to grade 8" · "Grade 9+" · undefined when open. */
export function gradeLabel(min: number | null, max: number | null): string | undefined {
  if (min == null && max == null) return undefined;
  if (min != null && max != null) {
    if (min === max) return `Grade ${gradeName(min)}`;
    return `Grades ${gradeName(min)}–${gradeName(max)}`;
  }
  if (max != null) return `Up to grade ${gradeName(max)}`;
  return `Grade ${gradeName(min as number)}+`;
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
  const days = calendarDaysUntil(nextDeadline, now, timeZone);
  if (days <= RELATIVE_WINDOW_DAYS) {
    const label =
      days <= 0 ? 'Closes today' : days === 1 ? 'Closes tomorrow' : `${days} days to go`;
    return { label, urgent: days <= URGENT_DAYS };
  }
  return { label: `Closes ${formatDate(nextDeadline, timeZone)}`, urgent: false };
}

/** "Texas" · "Texas +2" · undefined when untagged (stay factual — no "Nationwide" guess). */
export function regionLabel(regions: string[]): string | undefined {
  if (regions.length === 0) return undefined;
  if (regions.length === 1) return regions[0];
  return `${regions[0]} +${regions.length - 1}`;
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
    gradeLabel: gradeLabel(item.minGrade, item.maxGrade),
    organizerName: item.organizer?.name,
    organizerVerified: item.organizer?.verificationState === 'verified',
    summary: item.summary ?? undefined,
    free: item.costType === 'free',
    regionLabel: regionLabel(item.regions),
    // "Bragging rights" when no prize is on record (sweep item 16) — the footer's bold prize slot
    // then always renders. A null summary is uncurated, not a guaranteed no-prize; curators fill in
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
