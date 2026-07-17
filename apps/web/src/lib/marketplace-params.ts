// URL-param model for the marketplace (Page 2). Filters live in the query string so every
// state is shareable + crawlable (decision #13); parsing is defensive (the URL is user input).

import { GRADE_BANDS } from '@/lib/category-content';

export const PAGE_SIZE = 24; // divides evenly into 4-per-row and 3-per-row grids
export const MAX_PAGE = 9; // cumulative "Load more" cap — beyond this, refine instead

export const SORTS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'deadline', label: 'Deadline (soonest)' },
  { value: 'newest', label: 'Newest' },
  { value: 'relevance', label: 'Relevance' }, // meaningful only with a search query
] as const;

export const DEADLINE_WINDOWS = [
  { value: 7, label: 'Next 7 days' },
  { value: 30, label: 'Next 30 days' },
  { value: 90, label: 'Next 90 days' },
] as const;

export interface MarketplaceParams {
  q?: string;
  sort?: string;
  page: number;
  /** Query-param form (the panel's category facet on /competitions); hubs use the path instead. */
  category?: string;
  minGrade?: number;
  maxGrade?: number;
  region?: string;
  cost?: string;
  delivery?: string;
  participation?: string;
  pathway?: string;
  deadlineWithinDays?: number;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function str(raw: RawSearchParams, key: string): string | undefined {
  const value = raw[key];
  const s = Array.isArray(value) ? value[0] : value;
  return s && s.trim() !== '' ? s.trim() : undefined;
}

function num(raw: RawSearchParams, key: string, min: number, max: number): number | undefined {
  const s = str(raw, key);
  if (s === undefined) return undefined;
  const n = Number(s);
  if (!Number.isInteger(n) || n < min || n > max) return undefined;
  return n;
}

function token(raw: RawSearchParams, key: string, allowed: readonly string[]): string | undefined {
  const s = str(raw, key)?.toLowerCase();
  return s && allowed.includes(s) ? s : undefined;
}

export function parseMarketplaceParams(raw: RawSearchParams): MarketplaceParams {
  return {
    q: str(raw, 'q')?.slice(0, 200),
    sort: token(raw, 'sort', ['name', 'deadline', 'newest', 'relevance']),
    page: Math.min(num(raw, 'page', 0, 999) ?? 0, MAX_PAGE),
    category: str(raw, 'category')?.slice(0, 140),
    minGrade: num(raw, 'minGrade', -1, 12),
    maxGrade: num(raw, 'maxGrade', -1, 12),
    region: str(raw, 'region')?.slice(0, 60),
    cost: token(raw, 'cost', ['free', 'paid']),
    delivery: token(raw, 'delivery', ['in_person', 'virtual', 'hybrid']),
    participation: token(raw, 'participation', ['individual', 'team']),
    pathway: token(raw, 'pathway', ['individual', 'school_or_chapter']),
    deadlineWithinDays: num(raw, 'deadlineWithinDays', 1, 365),
  };
}

/** Query string for the given state; `overrides` set/remove (undefined) keys. Page resets unless kept. */
export function marketplaceHref(
  path: string,
  params: MarketplaceParams,
  overrides: Partial<Record<keyof MarketplaceParams, string | number | undefined>> = {},
): string {
  const merged: Record<string, string | number | undefined> = {
    q: params.q,
    sort: params.sort,
    category: params.category,
    minGrade: params.minGrade,
    maxGrade: params.maxGrade,
    region: params.region,
    cost: params.cost,
    delivery: params.delivery,
    participation: params.participation,
    pathway: params.pathway,
    deadlineWithinDays: params.deadlineWithinDays,
    ...overrides,
  };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Canonical path for a marketplace URL (R1-10). Filter/search/sort variants all fold to the
 * clean base path (their result sets are subsets/reorders — not distinct indexable pages), but a
 * page-only variant self-canonicalizes: declaring `?page=2` a duplicate of page 1 is exactly
 * what Google's post-rel-next pagination guidance warns against, and it would neuter the
 * crawlable "Load more" path (decision #13).
 */
/** Any search/sort/facet refinement active (page number aside)? Drives canonical + ItemList. */
export function hasActiveRefinement(p: MarketplaceParams): boolean {
  return (
    p.q !== undefined ||
    p.category !== undefined ||
    p.minGrade !== undefined ||
    p.maxGrade !== undefined ||
    p.region !== undefined ||
    p.cost !== undefined ||
    p.delivery !== undefined ||
    p.participation !== undefined ||
    p.pathway !== undefined ||
    p.deadlineWithinDays !== undefined ||
    p.sort !== undefined
  );
}

export function canonicalPath(basePath: string, raw: RawSearchParams): string {
  const p = parseMarketplaceParams(raw);
  if (hasActiveRefinement(p)) return basePath;
  return p.page > 0 ? `${basePath}?page=${p.page}` : basePath;
}

/** The active grade quick-chip band, if the current range exactly matches one. */
export function activeBand(params: MarketplaceParams): string | undefined {
  return GRADE_BANDS.find((b) => params.minGrade === b.minGrade && params.maxGrade === b.maxGrade)
    ?.key;
}

export interface ActiveChip {
  key: string;
  label: string;
  /** Href with this filter removed. */
  href: string;
}

const TOKEN_LABEL: Record<string, string> = {
  free: 'Free',
  paid: 'Paid',
  in_person: 'In person',
  virtual: 'Virtual',
  hybrid: 'Hybrid',
  individual: 'Individual',
  team: 'Team',
  school_or_chapter: 'School or chapter',
};

/** Removable-chip row under the toolbar (Page 2 §3). Search + sort aren't chips. */
export function activeChips(
  path: string,
  params: MarketplaceParams,
  regionName?: string,
  categoryName?: string,
): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (params.category) {
    chips.push({
      key: 'category',
      label: categoryName ?? params.category,
      href: marketplaceHref(path, params, { category: undefined }),
    });
  }
  // Grade: a band-exact range is represented by the highlighted quick-chip, NOT a removable
  // tag (A10 — value-canonical: depends only on the URL). Only custom ranges get a tag.
  if (
    (params.minGrade !== undefined || params.maxGrade !== undefined) &&
    activeBand(params) === undefined
  ) {
    chips.push({
      key: 'grade',
      label: `Grades ${params.minGrade ?? '…'}–${params.maxGrade ?? '…'}`,
      href: marketplaceHref(path, params, { minGrade: undefined, maxGrade: undefined }),
    });
  }
  if (params.region) {
    chips.push({
      key: 'region',
      label: regionName ?? params.region,
      href: marketplaceHref(path, params, { region: undefined }),
    });
  }
  if (params.deadlineWithinDays !== undefined) {
    chips.push({
      key: 'deadlineWithinDays',
      label: `Closes in ${params.deadlineWithinDays} days`,
      href: marketplaceHref(path, params, { deadlineWithinDays: undefined }),
    });
  }
  for (const key of ['cost', 'participation', 'pathway', 'delivery'] as const) {
    const value = params[key];
    if (value) {
      chips.push({
        key,
        label: TOKEN_LABEL[value] ?? value,
        href: marketplaceHref(path, params, { [key]: undefined }),
      });
    }
  }
  return chips;
}

/**
 * Zero-results near-miss (decision #14): relax the least-important active filter first —
 * the reverse of the facet-importance order (Grade most important … Delivery least).
 */
export const RELAX_ORDER: { key: keyof MarketplaceParams | 'grade'; label: string }[] = [
  { key: 'delivery', label: 'delivery' },
  { key: 'pathway', label: 'entry pathway' },
  { key: 'participation', label: 'individual/team' },
  { key: 'cost', label: 'cost' },
  { key: 'deadlineWithinDays', label: 'deadline window' },
  { key: 'region', label: 'region' },
  { key: 'grade', label: 'grade range' },
];
