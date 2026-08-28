// TS mirrors of the R1-3 admin API DTOs (apps/api catalog.curation.web). Kept minimal — only
// the fields the admin UI reads/writes. Server-side rules remain the real gate (CLAUDE.md);
// these are for editor ergonomics, not trust.

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/** Shared server-action result for useActionState-driven admin forms. */
export interface FormState {
  ok: boolean;
  error?: string;
}

/**
 * Create-organization result. Carries the created row so the caller can show it and — in the
 * add-a-listing flow — select it immediately, without a page refresh to re-fetch the list.
 */
export interface OrganizationFormState extends FormState {
  organization?: Organization;
}

export const PARTICIPATION_MODES = ['INDIVIDUAL', 'TEAM', 'BOTH'] as const;
export const DELIVERIES = ['IN_PERSON', 'VIRTUAL', 'HYBRID'] as const;
// Widened 2026-08-23 (owner): school/chapter split, EITHER renamed OPEN. Legacy EITHER is NOT
// offered — migration 0016 rewrites those rows — but SCHOOL_OR_CHAPTER stays selectable, since
// some competitions genuinely accept either route.
export const ENTRY_PATHWAYS = [
  'INDIVIDUAL',
  'SCHOOL',
  'CHAPTER',
  'SCHOOL_OR_CHAPTER',
  'OPEN',
] as const;
// Which axis the ORGANIZER states (0023, glossary "Eligibility basis"). The stated axis is what
// every summary surface renders; the other, when present, is a derived search range and must never
// be shown as a rule. Absent (null) is a real state — "not stated" — and NOT a default to GRADE.
export const ELIGIBILITY_BASES = ['GRADE', 'AGE', 'BOTH', 'OPEN'] as const;
export type EligibilityBasis = (typeof ELIGIBILITY_BASES)[number];

export const COST_TYPES = ['FREE', 'PAID'] as const;
export const RECURRENCES = ['ANNUAL', 'ONE_OFF', 'ROLLING'] as const;
// Org trust ladder (R1-19): CURATED (unclaimed) → CLAIMED → VERIFIED. Competitions have no
// trust state of their own (derived from the org). The admin org control defines its own
// labeled options; this token list is kept for reference / future use.
export const ORG_TRUST_STATES = ['CURATED', 'CLAIMED', 'VERIFIED'] as const;
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
// Canonical evaluation tokens (R1-5 EvaluationTypes.TOKENS) — stored/validated LOWERCASE, unlike
// the other UPPERCASE enums. Server validates these at the curation write boundary.
export const EVALUATION_TYPES = [
  'exam',
  'submission',
  'live_performance',
  'interview',
  'portfolio',
] as const;
export const RESOURCE_TYPES = ['BOOK', 'PAST_PAPER', 'GUIDE', 'VIDEO', 'OTHER'] as const;
// Listing lifecycle (§8a, item 14): DRAFT → IN_REVIEW → PUBLISHED ⇄ UNLISTED; archived is the
// separate archived_at axis. Only PUBLISHED passes the public gate.
export const LISTING_STATUSES = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'UNLISTED'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const REGION_LEVELS = ['COUNTRY', 'STATE', 'COUNTY', 'CITY', 'VIRTUAL'] as const;
export const ORG_TYPES = ['HOST', 'SCHOOL', 'SPONSOR', 'OTHER'] as const;
export const HERO_POSITIONS = ['MAIN', 'TOP_RIGHT', 'BOTTOM_LEFT'] as const;

// The wall-clock an admin types is interpreted in THIS zone (default Eastern), never the
// server's — the display + the stored instant both use it (lib/dates.zonedWallClockToInstant).
// Shared by the key-date manager and the combined create form.
/**
 * Zone picker for admin key dates. Labelled by ABBREVIATION first (owner 2026-08-24) — curators
 * read "EST" off an organizer's page, not "Eastern", so the list should answer in the same words.
 *
 * ⚠ The abbreviations are the STANDARD-time ones and stay put year-round: a June deadline in
 * America/New_York is really EDT, not EST. That is cosmetic only — the stored value is the IANA
 * zone, so `zonedWallClockToInstant` applies the right offset for the date in question. Showing a
 * live EST/EDT toggle would mean recomputing the label per row against that row's date, which
 * buys nothing: both spellings name the same zone.
 */
export const ADMIN_TIMEZONES = [
  { value: 'America/New_York', label: 'EST (New York)' },
  { value: 'America/Chicago', label: 'CST (Chicago)' },
  { value: 'America/Denver', label: 'MST (Denver)' },
  { value: 'America/Los_Angeles', label: 'PST (Los Angeles)' },
  { value: 'America/Anchorage', label: 'AKST (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'HST (Honolulu)' },
  { value: 'UTC', label: 'UTC' },
];

export interface Competition {
  id: string;
  slug: string;
  name: string;
  organizerOrgId: string | null;
  officialUrl: string | null;
  logo: string | null;
  description: string | null;
  categoryId: string;
  tags: string[] | null;
  participationMode: string;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  delivery: string;
  entryPathway: string;
  evaluationType: string[] | null;
  /** Which axis the ORGANIZER states: 'GRADE' | 'AGE' | 'BOTH' | 'OPEN'; null = not stated. */
  eligibilityBasis: EligibilityBasis | null;
  minGrade: number | null;
  maxGrade: number | null;
  minAge: number | null;
  maxAge: number | null;
  costType: string;
  recurrence: string;
  attributes: Record<string, unknown> | null;
  provenanceSource: string | null;
  verificationState: string;
  /** §8a lifecycle — only PUBLISHED is publicly visible (with the readiness gate). */
  listingStatus: ListingStatus;
  /** When the listing FIRST entered PUBLISHED; null while never-yet-published. */
  approvedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  /**
   * Readiness gate, precomputed by the admin LIST endpoint only. `null` means "not computed"
   * (every other endpoint), never "no edition" — don't render a badge off a null.
   */
  hasLiveEdition: boolean | null;
}

export interface Edition {
  id: string;
  competitionId: string;
  cycleLabel: string;
  status: string;
  registrationUrl: string | null;
  entryFee: number | null;
  currency: string | null;
  ageCutoffDate: string | null;
  prizeSummary: string | null;
  prizeValue: number | null;
  prizeCurrency: string | null;
  scopeLevel: string;
  advancesToEditionId: string | null;
  attributes: Record<string, unknown> | null;
  verificationState: string;
  archivedAt: string | null;
  version: number;
}

export interface KeyDate {
  id: string;
  type: string;
  label: string | null;
  /** null = TBD (R1-18): the milestone exists but its date isn't known yet. */
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: string;
  isAffiliate: boolean;
  affiliateMeta: Record<string, unknown> | null;
  displayOrder: number;
  imageUrl: string | null;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  domain: string | null;
  verificationState: string;
  archivedAt: string | null;
  version: number;
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
}

export interface CategoryTemplate {
  id: string;
  categoryId: string;
  jsonSchema: Record<string, unknown>;
  uiHints: Record<string, unknown> | null;
}

export interface Region {
  id: string;
  parentId: string | null;
  level: string;
  name: string;
  code: string | null;
}

export interface ImportRecord {
  id: string;
  payload: Record<string, unknown>;
  sourceUrl: string | null;
  confidence: number | null;
  status: string;
  /** PIPELINE (S3/admin ingress) vs USER_REQUEST (public Request-a-Competition form, DQ15). */
  origin: 'PIPELINE' | 'USER_REQUEST';
  note: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /**
   * The live competition already holding this payload's slug, if any — approving would collide.
   * Computed per page by the API (one lookup, not one per row); archived listings count, because a
   * slug stays taken after archive (D7).
   */
  duplicateCompetitionId: string | null;
}

/** Sort orders the import queue offers — mirrors the API's ImportRecordSort enum. */
export const IMPORT_SORTS = ['CREATED_AT', 'CONFIDENCE', 'NAME', 'SOURCE_URL'] as const;
export type ImportSort = (typeof IMPORT_SORTS)[number];

export interface BulkOutcome {
  id: string;
  ok: boolean;
  status: string | null;
  error: string | null;
}

/** Always a 200 with per-id results — bulk review is deliberately not all-or-nothing. */
export interface BulkReviewResponse {
  succeeded: number;
  failed: number;
  results: BulkOutcome[];
}

export const CORRECTION_SUBJECT_TYPES = ['COMPETITION', 'EDITION', 'RESOURCE'] as const;

export interface CorrectionProposal {
  id: string;
  subjectType: string;
  subjectId: string;
  /** Display name of the subject (competition name, "competition · cycle", resource title); null if the subject vanished. */
  subjectName: string | null;
  payload: Record<string, unknown>;
  /** Detail endpoint only: the subject's current whitelisted values (null if the subject is gone). */
  currentValues: Record<string, unknown> | null;
  note: string | null;
  status: string;
  reviewedAt: string | null;
  createdAt: string;
}

export interface HeroCard {
  id: string;
  position: string;
  imageKey: string;
  altText: string;
  linkUrl: string | null;
  description: string | null;
  updatedAt: string;
}

/** The two slots in the landing "Competing changes what's possible" value-prop section. */
export const LANDING_SLOTS = ['PRIMARY', 'SECONDARY'] as const;

export interface ValuePropCard {
  id: string;
  position: string;
  imageKey: string | null;
  linkUrl: string;
  label: string;
  updatedAt: string;
}

export interface LandingStat {
  id: string;
  position: string;
  value: string;
  label: string;
  source: string | null;
  updatedAt: string;
}

export interface FeaturedSlot {
  id: string;
  competitionId: string;
  position: number;
}
