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

export const PARTICIPATION_MODES = ['INDIVIDUAL', 'TEAM', 'BOTH'] as const;
export const DELIVERIES = ['IN_PERSON', 'VIRTUAL', 'HYBRID'] as const;
export const ENTRY_PATHWAYS = ['INDIVIDUAL', 'SCHOOL_OR_CHAPTER', 'EITHER'] as const;
export const COST_TYPES = ['FREE', 'PAID'] as const;
export const RECURRENCES = ['ANNUAL', 'ONE_OFF', 'ROLLING'] as const;
// Org trust ladder (R1-19): CURATED (unclaimed) → CLAIMED → VERIFIED. Competitions have no
// trust state of their own (derived from the org). The admin org control defines its own
// labeled options; this token list is kept for reference / future use.
export const ORG_TRUST_STATES = ['CURATED', 'CLAIMED', 'VERIFIED'] as const;
export const EDITION_STATUSES = ['UPCOMING', 'OPEN', 'CLOSED', 'ONGOING', 'ARCHIVED'] as const;
export const SCOPE_LEVELS = ['NATIONAL', 'STATE', 'REGIONAL', 'LOCAL', 'VIRTUAL'] as const;
export const KEY_DATE_TYPES = [
  'REG_OPEN',
  'REG_CLOSE',
  'ROUND_START',
  'SUBMISSION_DUE',
  'RESULTS',
  'CUSTOM',
] as const;
export const RESOURCE_TYPES = ['BOOK', 'PAST_PAPER', 'GUIDE', 'VIDEO', 'OTHER'] as const;
export const REGION_LEVELS = ['COUNTRY', 'STATE', 'COUNTY', 'CITY', 'VIRTUAL'] as const;
export const ORG_TYPES = ['HOST', 'SCHOOL', 'SPONSOR', 'OTHER'] as const;
export const HERO_POSITIONS = ['MAIN', 'TOP_RIGHT', 'BOTTOM_LEFT'] as const;

export interface Competition {
  id: string;
  slug: string;
  name: string;
  organizerOrgId: string | null;
  officialUrl: string | null;
  logo: string | null;
  description: string | null;
  summary: string | null;
  categoryId: string;
  tags: string[] | null;
  participationMode: string;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  delivery: string;
  entryPathway: string;
  evaluationType: string[] | null;
  minGrade: number | null;
  maxGrade: number | null;
  minAge: number | null;
  maxAge: number | null;
  costType: string;
  recurrence: string;
  attributes: Record<string, unknown> | null;
  provenanceSource: string | null;
  verificationState: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
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
  note: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const CORRECTION_SUBJECT_TYPES = ['COMPETITION', 'EDITION', 'RESOURCE'] as const;

export interface CorrectionProposal {
  id: string;
  subjectType: string;
  subjectId: string;
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

export interface FeaturedSlot {
  id: string;
  competitionId: string;
  position: number;
}
