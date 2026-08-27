/**
 * The Spine payload shape. Deliberately mirrors apps/api's `CompetitionRequest` record so a
 * payload this tool emits deserializes 1:1 on the import queue's approve path.
 *
 * IMPORTANT: enum-valued fields use the SERVER enum constant names (UPPERCASE), because the
 * approve path does `ObjectMapper.convertValue(payload, CompetitionRequest.class)` with default
 * (case-sensitive) Jackson enum binding. `evaluationType` tokens, by contrast, are the canonical
 * LOWERCASE token set (EvaluationTypes.TOKENS).
 */

export const PARTICIPATION_MODES = ['INDIVIDUAL', 'TEAM', 'BOTH'] as const;
export const DELIVERIES = ['IN_PERSON', 'VIRTUAL', 'HYBRID'] as const;
export const ENTRY_PATHWAYS = ['INDIVIDUAL', 'SCHOOL_OR_CHAPTER', 'EITHER'] as const;
export const COST_TYPES = ['FREE', 'PAID'] as const;
export const RECURRENCES = ['ANNUAL', 'ONE_OFF', 'ROLLING'] as const;

/** Edition/key-date enums — mirror apps/api `EditionStatus`, `ScopeLevel`, `KeyDateType`. */
export const EDITION_STATUSES = ['UPCOMING', 'OPEN', 'CLOSED', 'ONGOING', 'ARCHIVED'] as const;
export const SCOPE_LEVELS = [
  'INTERNATIONAL',
  'NATIONAL',
  'STATE',
  'REGIONAL',
  'LOCAL',
  'VIRTUAL',
] as const;
export const KEY_DATE_TYPES = [
  'REG_OPEN',
  'REG_CLOSE',
  'ROUND_START',
  'SUBMISSION_DUE',
  'RESULTS',
  'CUSTOM',
] as const;

/** Canonical evaluation-type tokens — must match apps/api `EvaluationTypes.TOKENS` (lowercase). */
export const EVALUATION_TOKENS = [
  'submission',
  'exam',
  'live_performance',
  'interview',
  'portfolio',
] as const;

export type ParticipationMode = (typeof PARTICIPATION_MODES)[number];
export type Delivery = (typeof DELIVERIES)[number];
export type EntryPathway = (typeof ENTRY_PATHWAYS)[number];
export type CostType = (typeof COST_TYPES)[number];
export type Recurrence = (typeof RECURRENCES)[number];
export type EditionStatus = (typeof EDITION_STATUSES)[number];
export type ScopeLevel = (typeof SCOPE_LEVELS)[number];
export type KeyDateType = (typeof KEY_DATE_TYPES)[number];

/** Matches `CompetitionRequest`. `attributes` is validated against the Category Template schema. */
export interface CompetitionPayload {
  slug: string;
  name: string;
  organizerOrgId?: string | null;
  /**
   * The organization that RUNS the competition, verbatim from the page. The approve path resolves
   * this to an org by exact name (reuse) or creates one — so seeding never pre-creates orgs by hand.
   * null when the page doesn't state an organizer (flagged for manual assignment at review). We do
   * NOT emit `confirmNewOrganizer` — the pipeline never overrides the near-match guard; a curator does.
   */
  organizerName?: string | null;
  officialUrl?: string | null;
  logo?: string | null;
  /** Draft only — S4 curators write our own prose (facts aren't copyrightable, prose is). */
  description?: string | null;
  categoryId: string;
  tags?: string[] | null;
  participationMode: ParticipationMode;
  teamSizeMin?: number | null;
  teamSizeMax?: number | null;
  delivery: Delivery;
  entryPathway: EntryPathway;
  evaluationType?: string[] | null;
  /** Grade encoding: Pre-K -1, K 0, 1..12. */
  minGrade?: number | null;
  maxGrade?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  costType: CostType;
  recurrence: Recurrence;
  attributes?: Record<string, unknown> | null;
}

/**
 * The competition's FIRST edition (the year's running, per glossary) — mirrors apps/api's
 * `EditionRequest`. Optional: when the page describes no identifiable running we omit it rather
 * than invent one, and the curator adds it at S4.
 *
 * Only the three server-required fields are mandatory here. The admin CREATE FORM additionally
 * demands a registration URL and a prize, but those rules live on `CompetitionWithEditionRequest`
 * and deliberately do NOT apply to the import path — a competition page routinely states neither.
 */
export interface EditionPayload {
  /** e.g. "2026" or "2025-26". Required server-side (@NotBlank). */
  cycleLabel: string;
  status: EditionStatus;
  scopeLevel: ScopeLevel;
  registrationUrl?: string | null;
  entryFee?: number | null;
  /** 3-letter ISO code; required by the server whenever entryFee is set. */
  currency?: string | null;
  prizeSummary?: string | null;
  prizeValue?: number | null;
  prizeCurrency?: string | null;
  /** ISO date (yyyy-mm-dd). */
  ageCutoffDate?: string | null;
}

/**
 * A typed row on the edition's timeline — mirrors `CompetitionWithEditionRequest.FirstEditionKeyDate`.
 *
 * `startsAt` null means "this milestone exists, the date is not yet known" (TBD, R1-18). That
 * encoding is REQUIRED rather than optional: a guessed deadline on a minors-facing catalog can make
 * a student miss a real one, so an unknown date must stay unknown. See the prompt's date rules.
 */
export interface KeyDatePayload {
  type: KeyDateType;
  label?: string | null;
  /** ISO-8601 instant, or null for TBD. */
  startsAt?: string | null;
  endsAt?: string | null;
  /** IANA zone, e.g. "America/New_York". */
  timezone?: string | null;
}

/**
 * What actually goes on the wire as the import payload: the competition fields PLUS the two
 * seeding extras the approve path splits back out. `CompetitionPayload` stays a faithful 1:1
 * mirror of `CompetitionRequest`; this is that plus `edition`/`keyDates`.
 */
export interface SeedPayload extends CompetitionPayload {
  edition?: EditionPayload | null;
  keyDates?: KeyDatePayload[] | null;
}

/** What the LLM returns: the payload plus a self-reported confidence + notes for curators. */
export interface Extraction {
  payload: SeedPayload;
  /** Model's own 0..1 confidence in the extraction. Blended into the final score. */
  modelConfidence?: number;
  /** Free-text notes/uncertainties for the S4 reviewer (not persisted server-side). */
  reviewerNotes?: string;
}

/**
 * Known facts for a competition carried from the S2 master index (docs/seeding/master-index.csv).
 * These are UNVERIFIED editorial hints, not truth: they guide the extractor when the page is silent
 * and are compared against the extraction to FLAG disagreements for the S4 curator. The page always
 * wins on conflict (README methodology) — the hint just tells us where to look twice.
 */
export interface SeedHints {
  name?: string;
  organizer?: string;
  categorySlug?: string;
  /** free | paid | unknown */
  cost?: string;
  /** individual | team | both */
  participation?: string;
  /** individual | school_or_chapter | either */
  entryPathway?: string;
  /** Human grade band, e.g. "9-12", "K-8" — prompt hint only (not flagged; too ambiguous to parse). */
  gradeBand?: string;
  regionScope?: string;
}

/** The body POSTed to /api/v1/admin/import-records (matches `ImportSubmission`). */
export interface ImportSubmission {
  payload: SeedPayload;
  sourceUrl?: string;
  /** 0.00..1.00, two decimals — server field is a BigDecimal in that range. */
  confidence: number;
}
