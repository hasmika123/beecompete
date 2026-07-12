import type { CompetitionDetail, EditionView, KeyDateView } from '@/lib/catalog-types';

// Display derivation for the competition-detail page (R1-7, page-blueprints Page 3). Pure,
// server+client safe: no side-effecting imports. Wording rules live here (the components stay
// presentation-only), mirroring lib/catalog-display for the marketplace card.

// --- Enum → human label maps (lowercase public tokens, R1-1 as-built rule) ---

const KEY_DATE_LABELS: Record<string, string> = {
  reg_open: 'Registration opens',
  reg_close: 'Registration closes',
  round_start: 'Round begins',
  submission_due: 'Submission due',
  results: 'Results announced',
  custom: 'Event',
};

const DELIVERY_LABELS: Record<string, string> = {
  in_person: 'In person',
  virtual: 'Online',
  hybrid: 'Hybrid',
};

const PARTICIPATION_LABELS: Record<string, string> = {
  individual: 'Individual',
  team: 'Team',
  both: 'Individual or team',
};

const PATHWAY_LABELS: Record<string, string> = {
  individual: 'Enter as an individual',
  school_or_chapter: 'Through a school or chapter',
  either: 'Individually or through a school',
};

const RECURRENCE_LABELS: Record<string, string> = {
  annual: 'Annual',
  one_off: 'One-time',
  rolling: 'Rolling / ongoing',
};

const EVALUATION_LABELS: Record<string, string> = {
  submission: 'Submission',
  exam: 'Exam',
  live_performance: 'Live performance',
  interview: 'Interview',
  portfolio: 'Portfolio',
};

/** Key-date type → label; CUSTOM falls back to the curated per-date label when present. */
export function keyDateLabel(date: KeyDateView): string {
  if (date.type === 'custom' && date.label) return date.label;
  return date.label ?? KEY_DATE_LABELS[date.type] ?? date.type;
}

export function deliveryLabel(token: string): string {
  return DELIVERY_LABELS[token] ?? token;
}
export function participationLabel(token: string): string {
  return PARTICIPATION_LABELS[token] ?? token;
}
export function pathwayLabel(token: string): string {
  return PATHWAY_LABELS[token] ?? token;
}
export function recurrenceLabel(token: string): string {
  return RECURRENCE_LABELS[token] ?? token;
}
export function evaluationLabel(token: string): string {
  return EVALUATION_LABELS[token] ?? token;
}

// --- Dates ---

/** Absolute, human date — "Mar 3, 2026". Time is dropped (competitions are day-grained). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** ICS/Google compact UTC stamp — 20260303T090000Z. */
export function toCalendarStamp(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

// --- Edition + deadline selection ---

/**
 * The edition a visitor cares about: the one that's open, else the next upcoming, else the
 * most recent (API returns editions oldest→newest, so the last is newest). Undefined only
 * when a competition has no editions yet.
 */
export function currentEdition(editions: EditionView[]): EditionView | undefined {
  if (editions.length === 0) return undefined;
  return (
    editions.find((e) => e.effectiveStatus === 'open') ??
    editions.find((e) => e.effectiveStatus === 'upcoming') ??
    editions[editions.length - 1]
  );
}

export interface NextDeadline {
  iso: string;
  /** The key-date type that produced it (reg_close preferred, then submission_due). */
  kind: string;
}

/**
 * The next actionable deadline across all editions — earliest future REG_CLOSE, falling back
 * to SUBMISSION_DUE, then any future date. Mirrors the R1-5 search deadline semantics so the
 * card and the detail page agree. Undefined when nothing future remains.
 */
export function nextDeadline(
  editions: EditionView[],
  now: Date = new Date(),
): NextDeadline | undefined {
  const future = editions
    .flatMap((e) => e.keyDates)
    .filter((d) => new Date(d.startsAt).getTime() >= now.getTime());
  const pick = (type: string) =>
    future
      .filter((d) => d.type === type)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  const chosen =
    pick('reg_close') ??
    pick('submission_due') ??
    future.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  return chosen ? { iso: chosen.startsAt, kind: chosen.type } : undefined;
}

export interface TimelineDate {
  date: KeyDateView;
  label: string;
  past: boolean;
  isNext: boolean;
}

/**
 * The edition's key dates sorted for the timeline, each tagged past/next. The first date at or
 * after `now` is the "next" one (it carries the add-to-calendar link). Kept here so the
 * component stays pure — the `new Date()` default lives in this lib fn, not in render.
 */
export function timelineDates(edition: EditionView, now: Date = new Date()): TimelineDate[] {
  const sorted = [...edition.keyDates].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const nextIndex = sorted.findIndex((d) => new Date(d.startsAt).getTime() >= now.getTime());
  return sorted.map((date, i) => ({
    date,
    label: keyDateLabel(date),
    past: new Date(date.startsAt).getTime() < now.getTime(),
    isNext: i === nextIndex,
  }));
}

/** "Location/Online" for the at-a-glance strip: delivery drives it, regions add specificity. */
export function locationLabel(competition: CompetitionDetail, edition?: EditionView): string {
  if (competition.delivery === 'virtual') return 'Online';
  const regions = edition?.regions ?? [];
  if (regions.length > 0) {
    const names = regions.map((r) => r.name);
    const head = names.slice(0, 2).join(', ');
    const label = names.length > 2 ? `${head} +${names.length - 2}` : head;
    return competition.delivery === 'hybrid' ? `${label} · Hybrid` : label;
  }
  return deliveryLabel(competition.delivery);
}

/** Cost value for the at-a-glance strip: free reads positive; paid shows the fee when known. */
export function costLabel(competition: CompetitionDetail, edition?: EditionView): string {
  if (competition.costType === 'free') return 'Free';
  const fee = edition?.entryFee;
  if (fee != null) {
    const currency = edition?.currency ?? 'USD';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(fee));
    } catch {
      return `${fee} ${currency}`;
    }
  }
  return 'Paid';
}

/** Prize value for the at-a-glance strip — the edition's summary, else nothing. */
export function prizeLabel(edition?: EditionView): string | undefined {
  return edition?.prizeSummary ?? undefined;
}
