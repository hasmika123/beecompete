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
  // "Team" capitalised (owner 2026-08-27, #116) to match `entryFormatLabel` on the Logistics
  // tab — both name a mode, so both are proper nouns of the taxonomy, not descriptions.
  both: 'Individual or Team',
};

const PATHWAY_LABELS: Record<string, string> = {
  individual: 'Enter as an individual',
  school: 'Through a school',
  chapter: 'Through a chapter',
  school_or_chapter: 'Through a school or chapter',
  open: 'Open to all',
  // Pre-0016 spelling of `open` — kept so a stale row never renders a raw token.
  either: 'Open to all',
};

const RECURRENCE_LABELS: Record<string, string> = {
  annual: 'Annual',
  one_off: 'One-time',
  rolling: 'Rolling / ongoing',
};

/**
 * Edition scope level (domain `ScopeLevel`) — how far a running reaches. Lowercase public
 * tokens per the R1-1 rule. `virtual` is a SCOPE ("no fixed geography"), not the delivery mode,
 * so it is worded differently from DELIVERY_LABELS.virtual to keep the two rows distinguishable
 * when both render on the Logistics tab.
 */
const SCOPE_LABELS: Record<string, string> = {
  international: 'International',
  national: 'National',
  state: 'Statewide',
  regional: 'Regional',
  local: 'Local',
  virtual: 'Online — no fixed region',
};

const EVALUATION_LABELS: Record<string, string> = {
  submission: 'Submission',
  exam: 'Exam',
  live_performance: 'Live performance',
  interview: 'Interview',
  portfolio: 'Portfolio',
};

/**
 * The wording the PUBLIC timeline uses for a milestone type when no curated label overrides it.
 * Case-insensitive because the admin enums are UPPERCASE and the stored/public tokens are not.
 *
 * Exported so the admin's Label field can show it as a PLACEHOLDER (2026-08-24): the curator sees
 * exactly what a visitor will read and only types when they want something else. Deliberately not
 * pre-FILLED — storing "Registration opens" would duplicate the type, and a stored label wins over
 * this map forever, so every listing curated today would be frozen at today's wording.
 */
export function defaultKeyDateLabel(type: string): string {
  return KEY_DATE_LABELS[type.toLowerCase()] ?? type;
}

/** Key-date type → label; CUSTOM falls back to the curated per-date label when present. */
export function keyDateLabel(date: KeyDateView): string {
  if (date.type === 'custom' && date.label) return date.label;
  return date.label ?? defaultKeyDateLabel(date.type);
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
export function scopeLabel(token: string): string {
  return SCOPE_LABELS[token] ?? token;
}

// --- Logistics row values (owner 2026-08-27, #111) ---------------------------------------------
// The tab briefly opened with a composed sentence (#110); it is now a plain ledger of icon rows,
// so the only thing left to derive is the entry format — participation mode and team size read as
// one fact ("Individual or team of 1–3"), not two rows, because a bare "1–3 members" row means
// nothing without the mode beside it and the two icons would have had to be near-identical.

function teamRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `${min}–${max}`;
  if (max != null) return `up to ${max}`;
  if (min != null) return `${min} or more`;
  return null;
}

/**
 * Participation mode with its team bounds folded in, as "Individual or Team (1–3)" (owner
 * 2026-08-27, #114). The bounds ride in parentheses so the mode stays the scannable part and the
 * size reads as its qualifier; Team is capitalised to match Individual, since both name a mode
 * rather than describing one. Degrades to the bare mode when a listing has no curated sizes —
 * never "Team (null)".
 */
export function entryFormatLabel(competition: CompetitionDetail): string {
  const range = teamRange(competition.teamSizeMin, competition.teamSizeMax);
  const team = range ? `Team (${range})` : 'Team';
  if (competition.participationMode === 'team') return team;
  if (competition.participationMode === 'both') return `Individual or ${team}`;
  return 'Individual';
}

/**
 * `student_status_required` as a REQUIREMENT rather than a yes/no (owner 2026-08-27, #114): the
 * field reads "Student status · Required", not "Student status required · Yes". Falls back to the
 * generic renderer for a non-boolean, which `0022` should have made impossible but which a stale
 * row or a hand-edited bag could still produce.
 */
export function studentStatusLabel(value: unknown): string | null {
  if (typeof value === 'boolean') return value ? 'Required' : 'Not required';
  return renderAttrValue(value);
}

/**
 * A URL as a human reads it: no scheme, no `www.`, no trailing slash. The FULL remaining address
 * is returned — truncation is the layout's job (CSS ellipsis), never this function's, so a copied
 * link is always the real one and the visible text never lies about where it goes.
 */
export function displayUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
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
  // "Student status", not "…required": the requirement is the VALUE (Required / Not required),
  // so folding it into the label made the row read "Student status required — Yes" (#114).
  student_status_required: 'Student status',
  // The catch-all prose row (2026-08-24) — last on purpose: it qualifies the typed rows above
  // it, and it's the one value long enough to be a sentence rather than a fact.
  other_eligibility_requirements: 'Other requirements',
};

/**
 * Judging catalog-info keys (2026-08-22 template additions) — rendered on the Judging tab, so
 * excluded from the Overview overflow the same way the eligibility keys are. `rules_url` is
 * handled separately (it renders as a link, not a text row).
 */
export const JUDGING_ATTR_LABELS: Record<string, string> = {
  judging_criteria: 'What judges look for',
  tie_breakers: 'Tie-breakers',
};

/**
 * Contact keys from the attributes bag (declared on EVERY category template by changelog `0019`,
 * curated on the admin form's Administration step). Rendered on the FAQ tab since #110 (they were
 * Logistics rows before), so excluded from the More overflow the same way the eligibility and
 * judging keys are — this map is what performs that exclusion, wherever the values end up drawn.
 * ⚠ Both render as links (mailto:/tel:), so they are validated at the point of use — see
 * `contactEmail`/`contactPhone` in contact-card.tsx: the bag is untrusted JSONB.
 */
export const LOGISTICS_ATTR_LABELS: Record<string, string> = {
  contact_email: 'Contact email',
  contact_phone: 'Contact phone',
};

export const RULES_URL_ATTR = 'rules_url';

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

/**
 * A humanized attributes-bag entry. Presentation-free on purpose: rendering (columns, icons,
 * links, notes) belongs to DetailLedger, which takes ReactNode values — this type only carries
 * what `categoryAttributeRows` can derive from the JSONB bag.
 */
export interface AttrRow {
  label: string;
  value: string;
}

/** Every attribute EXCEPT keys that earned a designed home (Eligibility/Judging/Logistics tabs)
 * — the More tab's payload (#106, retabbed by #87, moved off Overview by #108). */
export function categoryAttributeRows(attributes: Record<string, unknown> | null): AttrRow[] {
  return Object.entries(attributes ?? {})
    .filter(
      ([key]) =>
        !(key in ELIGIBILITY_ATTR_LABELS) &&
        !(key in JUDGING_ATTR_LABELS) &&
        !(key in LOGISTICS_ATTR_LABELS) &&
        key !== RULES_URL_ATTR,
    )
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

/**
 * "Location/Online" for the at-a-glance strip: delivery drives it, regions add specificity.
 *
 * ⚠ NO "· Hybrid" SUFFIX since #116 (owner 2026-08-27). It used to append the delivery mode for
 * hybrid runnings, which (a) duplicated the strip's own Delivery cell two columns away, and
 * (b) pushed the value past the cell's truncation point, so a visitor read
 * "Washington, Oregon +2 · Hy…" — an ellipsis stacked on top of the "+2" that already says
 * "there are more". The count is the overflow signal here; nothing should follow it.
 */
export function locationLabel(competition: CompetitionDetail, edition?: EditionView): string {
  if (competition.delivery === 'virtual') return 'Online';
  const regions = edition?.regions ?? [];
  if (regions.length > 0) {
    const names = regions.map((r) => r.name);
    const head = names.slice(0, 2).join(', ');
    return names.length > 2 ? `${head} +${names.length - 2}` : head;
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

/**
 * A YouTube video's thumbnail, DERIVED from the id already sitting in the resource's own URL
 * (owner 2026-08-28). No fetch, no API key, and — the point — nothing to guess: unlike an Amazon
 * image id or an `og:image`, this URL is a pure function of the link we were given, so it is
 * computed in code rather than asked of a model that could only hallucinate it.
 *
 * Rendered, never STORED: `imageUrl` stays whatever a curator set, and this fills the gap at
 * display time. That keeps a value we never verified out of the database and means the day
 * YouTube changes the pattern, one function changes rather than every stored row going stale.
 *
 * `hqdefault` on purpose — `maxresdefault` is higher-resolution but only exists for some uploads,
 * and a 404 there would drop the card to generic art for no reason. hqdefault exists for every
 * video, and the art box contains rather than crops it, so its 4:3 frame renders whole.
 *
 * ⚠ The id pattern is the security boundary. This builds a URL from caller-supplied text, so only
 * an exact 11-character YouTube id may reach the output — never an arbitrary substring of a URL a
 * curator or a model pasted.
 */
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeThumbnail(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
  if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) return undefined;

  const segments = parsed.pathname.split('/').filter(Boolean);
  // youtu.be/<id> puts the id in the path; every youtube.com form either uses ?v= or a
  // /<kind>/<id> path (shorts, embed, live, v).
  const candidate = parsed.hostname.toLowerCase().endsWith('youtu.be')
    ? segments[0]
    : (parsed.searchParams.get('v') ??
      (segments.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(segments[0]!)
        ? segments[1]
        : undefined));

  return candidate && YOUTUBE_ID.test(candidate)
    ? `https://i.ytimg.com/vi/${candidate}/hqdefault.jpg`
    : undefined;
}
