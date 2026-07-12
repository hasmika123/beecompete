import type { CompetitionCardData } from '@beecompete/ui';
import type { CompetitionSummary } from '@/lib/catalog-types';

// Display derivation for catalog data — the CompetitionCard is presentation-only, so the
// wording rules live here: grade encoding (Q2: Pre-K = −1, K = 0, 1–12), relative deadline
// inside a ~14-day window (blueprints decision #12) with the danger tint only in the final
// days (owner r8), and the region label. Server + client safe (no imports with side effects).

export function gradeName(grade: number): string {
  if (grade <= -1) return 'Pre-K';
  if (grade === 0) return 'K';
  return String(grade);
}

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

const DAY_MS = 24 * 60 * 60 * 1000;
const RELATIVE_WINDOW_DAYS = 14;
const URGENT_DAYS = 3;

export interface DeadlineDisplay {
  label: string;
  urgent: boolean;
}

/** Factual urgency only — relative wording inside the window, absolute date beyond it. */
export function deadlineDisplay(
  nextDeadline: string | null,
  now = new Date(),
): DeadlineDisplay | undefined {
  if (!nextDeadline) return undefined;
  const deadline = new Date(nextDeadline);
  const days = Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS);
  if (days < 0) return undefined; // stale data — say nothing rather than "closed" (server decides)
  if (days <= RELATIVE_WINDOW_DAYS) {
    const label = days === 0 ? 'Closes today' : days === 1 ? '1 day to go' : `${days} days to go`;
    return { label, urgent: days <= URGENT_DAYS };
  }
  return {
    label: `Closes ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    urgent: false,
  };
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
    gradeLabel: gradeLabel(item.minGrade, item.maxGrade),
    organizerName: item.organizer?.name,
    organizerVerified: item.organizer?.verificationState === 'verified',
    summary: item.summary ?? undefined,
    free: item.costType === 'free',
    regionLabel: regionLabel(item.regions),
    prizeLabel: item.prizeSummary ?? undefined,
    deadlineLabel: deadline?.label,
    deadlineUrgent: deadline?.urgent,
  };
}
