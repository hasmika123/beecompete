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
  summary?: string | null;
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

/** What the LLM returns: the payload plus a self-reported confidence + notes for curators. */
export interface Extraction {
  payload: CompetitionPayload;
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
  payload: CompetitionPayload;
  sourceUrl?: string;
  /** 0.00..1.00, two decimals — server field is a BigDecimal in that range. */
  confidence: number;
}
