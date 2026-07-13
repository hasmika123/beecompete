import 'server-only';

import { publicFetch } from '@/lib/public-api';
import type {
  CategoryOption,
  CompetitionDetail,
  LandingView,
  RegionOption,
  SearchResponse,
  SitemapEntry,
} from '@/lib/catalog-types';

// Public catalog reads are cached + revalidated (ISR, R1-10) rather than no-store, so the
// pages that use them (detail, landing, category/grade hubs, sitemap) render statically and
// refresh hourly. One window for the whole catalog surface; the admin write path is uncached.
const CATALOG_REVALIDATE = 3600;

/** The marketplace's filter state — mirrors the R1-5 search params (all optional). */
export interface SearchParams {
  q?: string;
  category?: string;
  minGrade?: number;
  maxGrade?: number;
  region?: string;
  cost?: string;
  delivery?: string;
  participation?: string;
  pathway?: string;
  deadlineWithinDays?: number;
  sort?: string;
  facets?: boolean;
  page?: number;
  size?: number;
}

export async function searchCompetitions(params: SearchParams): Promise<SearchResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return publicFetch<SearchResponse>(`/competitions${qs ? `?${qs}` : ''}`, {
    revalidate: CATALOG_REVALIDATE,
  });
}

export async function fetchCompetition(slug: string): Promise<CompetitionDetail> {
  return publicFetch<CompetitionDetail>(`/competitions/${encodeURIComponent(slug)}`, {
    revalidate: CATALOG_REVALIDATE,
  });
}

export async function fetchRegions(): Promise<RegionOption[]> {
  return publicFetch<RegionOption[]>('/regions', { revalidate: CATALOG_REVALIDATE });
}

export async function fetchCategories(): Promise<CategoryOption[]> {
  return publicFetch<CategoryOption[]>('/categories', { revalidate: CATALOG_REVALIDATE });
}

export async function fetchLanding(): Promise<LandingView> {
  return publicFetch<LandingView>('/landing', { revalidate: CATALOG_REVALIDATE });
}

export async function fetchSitemapEntries(): Promise<SitemapEntry[]> {
  return publicFetch<SitemapEntry[]>('/sitemap', { revalidate: CATALOG_REVALIDATE });
}
