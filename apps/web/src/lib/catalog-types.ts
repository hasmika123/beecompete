// TS mirrors of the public catalog API DTOs (apps/api catalog.web.CatalogPublicController).
// Only fields the web reads. Lowercase public enum tokens throughout (R1-1 as-built rule).

export interface CategoryRef {
  slug: string;
  name: string;
}

export interface OrganizerRef {
  name: string;
  type: string;
  verificationState: string;
}

export interface ProvenanceRef {
  source: string;
  lastVerifiedAt: string | null;
  confidence: number | null;
}

export interface CompetitionSummary {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  logo: string | null;
  category: CategoryRef;
  organizer: OrganizerRef | null;
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
  verificationState: string;
  provenance: ProvenanceRef | null;
  nextDeadline: string | null;
  prizeSummary: string | null;
  regions: string[];
}

export interface CategoryFacet {
  slug: string;
  name: string;
  count: number;
}

export interface GradeFacet {
  grade: number;
  count: number;
}

export interface SearchFacets {
  categories: CategoryFacet[];
  grades: GradeFacet[];
}

export interface SearchResponse {
  content: CompetitionSummary[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  facets: SearchFacets | null;
}

export interface RegionOption {
  id: string;
  level: string;
  name: string;
  code: string | null;
  count: number;
}

export interface KeyDateView {
  type: string;
  label: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
}

export interface RegionView {
  level: string;
  name: string;
  code: string | null;
}

export interface EditionView {
  id: string;
  cycleLabel: string;
  status: string;
  effectiveStatus: string;
  scopeLevel: string;
  registrationUrl: string | null;
  entryFee: number | null;
  currency: string | null;
  ageCutoffDate: string | null;
  prizeSummary: string | null;
  prizeValue: number | null;
  prizeCurrency: string | null;
  attributes: Record<string, unknown> | null;
  verificationState: string;
  keyDates: KeyDateView[];
  regions: RegionView[];
}

export interface ResourceView {
  id: string;
  title: string;
  url: string;
  type: string;
  isAffiliate: boolean;
  displayOrder: number;
}

export interface FaqView {
  question: string;
  answer: string;
  displayOrder: number;
}

export interface CompetitionDetail extends Omit<
  CompetitionSummary,
  'nextDeadline' | 'prizeSummary' | 'regions'
> {
  description: string | null;
  officialUrl: string | null;
  attributes: Record<string, unknown> | null;
  editions: EditionView[];
  resources: ResourceView[];
  faqs: FaqView[];
}
