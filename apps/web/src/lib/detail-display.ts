import type { CompetitionDetail, EditionView, KeyDateView } from '@/lib/catalog-types';
import { deadlineDisplay } from '@/lib/catalog-display';
import { formatDate } from '@/lib/dates';

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

const EDITION_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  upcoming: 'Upcoming',
  ongoing: 'In progress',
  closed: 'Closed',
  archived: 'Archived',
};

/**
 * Edition effective-status → label. Lived in the detail page until #88 moved the status out of
 * the header tag row and into the At-a-glance strip.
 * ⚠ Deliberately SHORTER than the old badge wording ("Registration open"/"Registration closed"):
 * a standalone badge had to name what was open, but a strip item is already labelled "Status", and
 * the long strings truncated to "Registration o…" in the strip's 2-column mobile grid.
 */
export function editionStatusLabel(token: string): string {
  return EDITION_STATUS_LABELS[token] ?? token;
}

// --- JSONB `attributes` bag rendering (shared by the Details and About tabs) ---
// Lives here rather than in key-facts.tsx because BOTH tabs read the bag since #106: Details
// renders the standard eligibility keys, About dumps everything else.

/**
 * The standard eligibility keys from the attributes bag (domain-model, conventional 2026-07-08).
 * Pulled OUT of the generic list and rendered under Eligibility with proper labels —
 * humanizeAttrKey would title-case them into the wrong section. ⚠ Planned promotion to Spine
 * columns (filterable) at Phase 3 — sweep-remediation-plan §16; labels here survive that move.
 */
export const ELIGIBILITY_ATTR_LABELS: Record<string, string> = {
  eligible_countries: 'Eligible countries',
  citizenship_countries: 'Citizenship',
  student_status_required: 'Student status',
};

export function humanizeAttrKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function renderAttrValue(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) {
    const parts = value.map(renderAttrValue).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return null; // skip nested objects at R1
  return String(value);
}

export interface AttrRow {
  label: string;
  value: string;
}

/** Every attribute EXCEPT the eligibility keys, humanized — the About tab's payload (#106). */
export function categoryAttributeRows(attributes: Record<string, unknown> | null): AttrRow[] {
  return Object.entries(attributes ?? {})
    .filter(([key]) => !(key in ELIGIBILITY_ATTR_LABELS))
    .map(([key, value]) => ({ label: humanizeAttrKey(key), value: renderAttrValue(value) }))
    .filter((r): r is AttrRow => r.value != null);
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  book: 'Book',
  past_paper: 'Past paper',
  guide: 'Guide',
  video: 'Video',
  other: 'Resource',
};

export function resourceTypeLabel(token: string): string {
  return RESOURCE_TYPE_LABELS[token] ?? 'Resource';
}

// --- Edition + deadline selection ---
// (Date FORMATTING lives in lib/dates — timezone-aware, review fix H1.)

/**
 * The edition a visitor cares about: open beats ongoing beats upcoming; otherwise the edition
 * with the most recent key date wins (review fix M2 — the API orders editions by CREATION
 * time, so "last in the list" breaks when a curator backfills an older edition later).
 * Undefined only when a competition has no editions yet.
 */
export function currentEdition(editions: EditionView[]): EditionView | undefined {
  if (editions.length === 0) return undefined;
  const byStatus = (status: string) => editions.find((e) => e.effectiveStatus === status);
  const latestKeyDate = (e: EditionView) =>
    e.keyDates.reduce(
      (max, d) => Math.max(max, d.startsAt ? new Date(d.startsAt).getTime() : 0),
      0,
    );
  const latestByDate = [...editions].sort((a, b) => latestKeyDate(b) - latestKeyDate(a))[0];
  return (
    byStatus('open') ??
    byStatus('ongoing') ??
    byStatus('upcoming') ??
    latestByDate ??
    editions[editions.length - 1]
  );
}

export interface NextDeadline {
  iso: string;
  /** The key-date type that produced it (reg_close preferred, then submission_due). */
  kind: string;
  /** The key date's own IANA zone (display must not use the server's zone — H1). */
  timezone: string | null;
}

/**
 * The next actionable deadline across all editions — earliest future REG_CLOSE, falling back
 * to SUBMISSION_DUE. EXACTLY mirrors the server's search/card deadline rule (R1-5 as amended
 * by the review fix pack) so the card and the detail page always agree; no further fallback.
 * Undefined when nothing future remains.
 */
export function nextDeadline(
  editions: EditionView[],
  now: Date = new Date(),
): NextDeadline | undefined {
  // TBD key dates (null startsAt, R1-18) are not concrete deadlines — excluded here.
  const future = editions
    .flatMap((e) => e.keyDates)
    .filter((d) => d.startsAt != null && new Date(d.startsAt).getTime() >= now.getTime());
  const pick = (type: string) =>
    future
      .filter((d) => d.type === type)
      .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())[0];
  const chosen = pick('reg_close') ?? pick('submission_due');
  return chosen && chosen.startsAt
    ? { iso: chosen.startsAt, kind: chosen.type, timezone: chosen.timezone }
    : undefined;
}

export interface DeadlineFact {
  /** The headline value — relative inside the 14-day window, otherwise the absolute date. */
  value: string;
  /** The absolute date, present ONLY when `value` is relative and would otherwise hide it. */
  hint?: string;
  urgent: boolean;
}

/**
 * The At-a-glance deadline cell (#89). `deadlineDisplay` deliberately goes relative inside its
 * 14-day window ("11 days to go"), which answers "how long?" but throws away "until WHEN?" —
 * previously you had to open the Timeline panel to recover the date. This pairs the two: the
 * relative value keeps the urgency, the absolute date rides along underneath it. Beyond the
 * window the value already IS the date, so there is no hint to add and adding one would just
 * print it twice.
 */
export function deadlineFact(deadline: NextDeadline, now?: Date): DeadlineFact {
  const absolute = formatDate(deadline.iso, deadline.timezone);
  const view = deadlineDisplay(deadline.iso, now, deadline.timezone);
  const value = view?.label ?? `Closes ${absolute}`;
  return {
    value,
    hint: value.includes(absolute) ? undefined : absolute,
    urgent: view?.urgent ?? false,
  };
}

/**
 * True when a deadline milestone (reg_close / submission_due) exists but its date is TBD
 * (null startsAt, R1-18). Used only as a fallback when {@link nextDeadline} is undefined, to
 * show "Deadline · TBD" instead of omitting the row entirely.
 */
export function hasTbdDeadline(editions: EditionView[]): boolean {
  return editions.some((e) =>
    e.keyDates.some(
      (d) => d.startsAt == null && (d.type === 'reg_close' || d.type === 'submission_due'),
    ),
  );
}

export interface TimelineDate {
  date: KeyDateView;
  label: string;
  past: boolean;
  isNext: boolean;
  /** TBD (null startsAt, R1-18): renders "Date TBD", never past/next, sorted last. */
  isTbd: boolean;
}

/**
 * The edition's key dates sorted for the timeline, each tagged past/next. The first DATED date
 * at or after `now` is the "next" one (it carries the add-to-calendar link). TBD dates (null
 * startsAt) sort last and are never past/next. Kept here so the component stays pure — the
 * `new Date()` default lives in this lib fn, not in render.
 */
export function timelineDates(edition: EditionView, now: Date = new Date()): TimelineDate[] {
  const dated = edition.keyDates.filter((d) => d.startsAt != null);
  const tbd = edition.keyDates.filter((d) => d.startsAt == null);
  const sorted = [...dated].sort(
    (a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime(),
  );
  const nextIndex = sorted.findIndex((d) => new Date(d.startsAt!).getTime() >= now.getTime());
  return [
    ...sorted.map((date, i) => ({
      date,
      label: keyDateLabel(date),
      past: new Date(date.startsAt!).getTime() < now.getTime(),
      isNext: i === nextIndex,
      isTbd: false,
    })),
    ...tbd.map((date) => ({
      date,
      label: keyDateLabel(date),
      past: false,
      isNext: false,
      isTbd: true,
    })),
  ];
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

/**
 * Cost value for the at-a-glance strip: free reads positive; paid shows the fee when known.
 * A zero fee on a PAID competition is treated as unknown data, not "$0.00" (review fix L1).
 */
export function costLabel(competition: CompetitionDetail, edition?: EditionView): string {
  if (competition.costType === 'free') return 'Free';
  const fee = edition?.entryFee;
  if (fee != null && Number(fee) > 0) {
    const currency = edition?.currency ?? 'USD';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(fee));
    } catch {
      return `${fee} ${currency}`;
    }
  }
  return 'Paid';
}

/**
 * Prize for the at-a-glance strip. #82 folds in the typed `prize_value` (it existed on Edition but
 * rendered nowhere): "$5,000 — Scholarships and medals" · "$5,000" · summary alone · "Bragging
 * rights" fallback (sweep item 16, owner-picked). The amount LEADS when present — it is the
 * scannable fact; the summary is its caption. Note: a null summary means the prize is *uncurated*,
 * not necessarily that there's none — curators still fill confirmed prizes in.
 */
export function prizeLabel(edition?: EditionView): string {
  const value = edition?.prizeValue;
  let amount: string | undefined;
  if (value != null && Number(value) > 0) {
    const currency = edition?.prizeCurrency ?? 'USD';
    try {
      amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        // "$5,000", not "$5,000.00" — cents only when the value actually has them.
        minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
      }).format(Number(value));
    } catch {
      amount = `${value} ${currency}`;
    }
  }
  const summary = edition?.prizeSummary ?? undefined;
  if (amount && summary) return `${amount} · ${summary}`;
  return amount ?? summary ?? 'Bragging rights';
}

/**
 * Earliest FUTURE reg_open across editions (#82). When present, registration has not opened yet,
 * so the at-a-glance deadline slot shows "Opens {date}" instead of "Closes {date}" — a bare close
 * date on a not-yet-open competition reads as "you can enter now", which is wrong.
 */
export function regOpensAt(
  editions: EditionView[],
  now: Date = new Date(),
): { iso: string; timezone: string | null } | undefined {
  const opens = editions
    .flatMap((e) => e.keyDates)
    .filter(
      (d) =>
        d.type === 'reg_open' &&
        d.startsAt != null &&
        new Date(d.startsAt).getTime() > now.getTime(),
    )
    .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())[0];
  return opens?.startsAt ? { iso: opens.startsAt, timezone: opens.timezone } : undefined;
}

/**
 * Age eligibility with its cutoff anchor (#82): "13–19 (as of Jun 1, 2027)". The cutoff is the
 * date age is computed AS OF (glossary: "under 19 as of June 1") — without it a bare range is
 * ambiguous for kids near the boundary. Undefined when the competition has no age gate at all.
 */
export function ageLabel(
  competition: CompetitionDetail,
  edition?: EditionView,
): string | undefined {
  const { minAge, maxAge } = competition;
  if (minAge == null && maxAge == null) return undefined;
  const range =
    minAge != null && maxAge != null
      ? `${minAge}–${maxAge}`
      : maxAge != null
        ? `Up to ${maxAge}`
        : `${minAge}+`;
  const cutoff = edition?.ageCutoffDate;
  if (!cutoff) return range;
  const anchored = new Date(cutoff);
  return Number.isNaN(anchored.getTime())
    ? range
    : `${range} (as of ${anchored.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })})`;
}
