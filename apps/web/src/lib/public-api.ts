import 'server-only';

// Public (unauthenticated) API calls, made server-side — the browser talks to Next server
// actions / server components, which call the Spring API over the internal network. Same BFF
// shape as admin-api.ts minus the token; the API stays unreachable off-box in production.

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8080';

/** A structured error carrying the API's status + message. */
export class PublicApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PublicApiError';
  }
}

interface PublicFetchOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  cache?: RequestCache;
  /**
   * ISR window in seconds (R1-10). When set, the read is cached and revalidated instead of
   * `no-store`, which lets the calling page be statically rendered + periodically refreshed
   * (the whole point of SSG/ISR). Ignored for mutations — those stay uncached.
   */
  revalidate?: number;
}

/** Calls `/api/v1{path}` on the Spring API. Throws {@link PublicApiError} on a non-2xx. */
export async function publicFetch<T>(path: string, options: PublicFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, cache, revalidate } = options;
  // A single no-store fetch anywhere in a page opts the whole page into dynamic rendering, so
  // ISR pages MUST pass revalidate on every read. Default stays no-store (mutations, dynamic).
  const cacheOpts =
    revalidate !== undefined ? { next: { revalidate } } : { cache: cache ?? 'no-store' };
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method,
    ...cacheOpts,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data && String(data.message)) ||
      `API ${res.status}`;
    throw new PublicApiError(res.status, message);
  }

  return data as T;
}
