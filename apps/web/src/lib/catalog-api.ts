import 'server-only';

import { publicFetch } from '@/lib/public-api';
import type {
  CategoryOption,
  CompetitionDetail,
  LandingView,
  RegionOption,
  SearchResponse,
} from '@/lib/catalog-types';

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
  return publicFetch<SearchResponse>(`/competitions${qs ? `?${qs}` : ''}`);
}

export async function fetchCompetition(slug: string): Promise<CompetitionDetail> {
  return publicFetch<CompetitionDetail>(`/competitions/${encodeURIComponent(slug)}`);
}

export async function fetchRegions(): Promise<RegionOption[]> {
  return publicFetch<RegionOption[]>('/regions');
}

export async function fetchCategories(): Promise<CategoryOption[]> {
  return publicFetch<CategoryOption[]>('/categories');
}

export async function fetchLanding(): Promise<LandingView> {
  return publicFetch<LandingView>('/landing');
}
