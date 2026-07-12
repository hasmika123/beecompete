import 'server-only';

// Admin BFF — the ONLY place the admin API token lives. Server-only (the import above makes a
// client bundle that pulls this in fail to build), so the X-Admin-Token secret never reaches the
// browser. The browser talks to Next server components / server actions; those call the Spring
// admin API over the internal network with the token injected here.
//
// Production auth chain: Cloudflare Access (email allow-list) gates /admin in the browser →
// Next server → API with X-Admin-Token (AdminTokenFilter, fail-closed) → the API is additionally
// unreachable off-box (BFF pattern). Token migrates to real RBAC at R2-7.

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8080';
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN ?? '';

/** A structured error carrying the API's status + message (surfaced to the admin, not the user). */
export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

interface AdminFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** GET caching: admin data is always live, so default no-store. */
  cache?: RequestCache;
}

/**
 * Calls `/api/v1/admin{path}` on the Spring API with the shared-secret header. Throws
 * {@link AdminApiError} on a non-2xx (message = the API's `message` field when present). Returns
 * `undefined` for 204 responses.
 */
export async function adminFetch<T>(path: string, options: AdminFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, cache = 'no-store' } = options;
  const res = await fetch(`${API_BASE_URL}/api/v1/admin${path}`, {
    method,
    cache,
    headers: {
      'X-Admin-Token': ADMIN_API_TOKEN,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data && String(data.message)) ||
      `admin API ${res.status}`;
    throw new AdminApiError(res.status, message);
  }

  return data as T;
}
