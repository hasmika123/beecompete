import type { Config } from './config.ts';

/**
 * Minimal, polite page fetcher for v0: sets a descriptive UA, times out, follows redirects
 * MANUALLY (re-checking robots.txt + the private-address guard on every hop, M5), caps the
 * response size (M3), rejects non-HTML content types (M3), and does a BASIC robots.txt check
 * (honours a `Disallow:` under a matching `User-agent:` group, exact-token match — L1). This is
 * not a full RFC 9309 parser — it covers the common cases so we don't hammer a disallowed path.
 * A production crawler would use a hardened robots library + rate limiting (see README).
 */

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  html: string;
  /** Plain-text distillation of the HTML, fed to the LLM. */
  text: string;
}

export interface FetchOptions {
  /** Allow fetching private/loopback/link-local addresses (SSRF guard opt-out, --allow-private). */
  allowPrivate?: boolean;
}

/** Hard cap on the response body (M3) — generous for any real competition page. */
export const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Transient-failure retry (v0). Real hosts intermittently drop a connection mid-TLS — in the
 * top-25 seeding sweep artandwriting.org failed on one row and succeeded on the next, same run.
 * We retry ONLY transient faults (a thrown network error, or a 5xx) with exponential backoff;
 * a 4xx (403 bot-block) or a robots-disallow is permanent and is NOT retried.
 */
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchPage(
  url: string,
  config: Config,
  opts: FetchOptions = {},
): Promise<FetchedPage> {
  let current = new URL(url);
  let res: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertPublicHost(current, opts.allowPrivate ?? false);
    const allowed = await robotsAllows(current, config);
    if (!allowed) {
      throw new Error(`robots.txt disallows fetching ${current.href} for our user-agent`);
    }
    res = await fetchWithRetry(current.href, config, 'manual');
    if (REDIRECT_STATUSES.has(res.status)) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => {});
      if (!location) {
        throw new Error(`redirect (${res.status}) without a Location header from ${current.href}`);
      }
      // Loop re-runs the private-host + robots checks against the redirect target (M5).
      current = new URL(location, current);
      res = null;
      continue;
    }
    break;
  }

  if (!res) {
    throw new Error(`too many redirects (>${MAX_REDIRECTS}) fetching ${url}`);
  }
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${res.statusText} for ${current.href}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    await res.body?.cancel().catch(() => {});
    throw new Error(
      `skipping ${current.href}: content-type "${contentType}" is not HTML ` +
        '(only text/html and application/xhtml+xml are supported)',
    );
  }
  const html = await readBodyCapped(res, MAX_RESPONSE_BYTES, current.href);
  return {
    url,
    finalUrl: current.href,
    status: res.status,
    html,
    text: htmlToText(html),
  };
}

/** Reads the body while enforcing the byte cap — a fast server can't balloon memory (M3). */
async function readBodyCapped(res: Response, maxBytes: number, href: string): Promise<string> {
  const declared = Number.parseInt(res.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`response too large (content-length ${declared} > ${maxBytes} bytes): ${href}`);
  }
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error(`response too large (>${maxBytes} bytes): ${href}`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * SSRF guard (M5): refuses loopback/private/link-local targets unless --allow-private. Checks
 * literal IPs + localhost names only; a public DNS name that RESOLVES to a private address is
 * not caught (documented README limitation — this is an operator-run CLI, not a server fetcher).
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;

  // IPv4 literal
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true; // this-net, private, loopback
    if (a === 169 && b === 254) return true; // link-local (cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  // IPv6 literal
  if (host.includes(':')) {
    if (host === '::' || host === '::1') return true; // unspecified, loopback
    if (/^f[cd]/.test(host)) return true; // unique-local fc00::/7
    if (/^fe[89ab]/.test(host)) return true; // link-local fe80::/10
    if (host.startsWith('::ffff:')) return isPrivateHost(host.slice(7)); // v4-mapped
  }
  return false;
}

function assertPublicHost(target: URL, allowPrivate: boolean): void {
  if (!allowPrivate && isPrivateHost(target.hostname)) {
    throw new Error(
      `refusing to fetch private/loopback address ${target.hostname} (${target.href}) — ` +
        'pass --allow-private if this is intentional',
    );
  }
}

/**
 * Wraps {@link timedFetch} with bounded exponential-backoff retries for TRANSIENT faults only:
 * a thrown network error (undici "fetch failed" = TCP/TLS drop, or an abort/timeout) or a 5xx.
 * A non-5xx response (incl. 403 bot-blocks and 404s) is returned to the caller unretried — those
 * are permanent, and the caller turns them into a clear, non-retryable error.
 */
async function fetchWithRetry(
  url: string,
  config: Config,
  redirect: RequestRedirect,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await timedFetch(url, config, redirect);
      if (res.status >= 500 && res.status <= 599 && attempt < MAX_FETCH_ATTEMPTS) {
        await res.body?.cancel().catch(() => {});
        await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt >= MAX_FETCH_ATTEMPTS) break;
      await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
  throw lastErr;
}

async function timedFetch(
  url: string,
  config: Config,
  redirect: RequestRedirect,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
  try {
    return await fetch(url, {
      redirect,
      signal: controller.signal,
      headers: { 'user-agent': config.userAgent, accept: 'text/html,application/xhtml+xml' },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches /robots.txt and applies the longest-matching Disallow for our UA (best-effort). */
async function robotsAllows(target: URL, config: Config): Promise<boolean> {
  const robotsUrl = `${target.origin}/robots.txt`;
  let body: string;
  try {
    const res = await timedFetch(robotsUrl, config, 'follow');
    if (res.status === 404 || res.status === 410) return true; // no robots = allowed
    if (!res.ok) return true; // unreadable robots — fail open, but we still set a UA
    body = await res.text();
  } catch {
    return true; // network hiccup fetching robots — don't block the run
  }
  return pathAllowed(body, target.pathname, config.userAgent);
}

/**
 * Tiny robots evaluator: collects rules from the group whose `User-agent` EXACTLY matches our UA
 * product token (L1 — no substring matching, so a group for "bot" doesn't capture us), falling
 * back to the `*` group, then applies the longest matching path prefix (Allow wins ties).
 */
export function pathAllowed(robotsTxt: string, path: string, userAgent: string): boolean {
  const uaToken = userAgent.split('/')[0]?.trim().toLowerCase() ?? '';
  const groups = parseRobots(robotsTxt);
  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && a === uaToken));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const group = specific ?? wildcard;
  if (!group) return true;

  let decision = true;
  let matchLen = -1;
  for (const rule of group.rules) {
    if (rule.path === '') continue;
    if (path.startsWith(rule.path) && rule.path.length > matchLen) {
      matchLen = rule.path.length;
      decision = rule.allow;
    } else if (path.startsWith(rule.path) && rule.path.length === matchLen && rule.allow) {
      decision = true; // Allow wins ties
    }
  }
  return decision;
}

interface RobotsGroup {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

function parseRobots(txt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let expectingAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!current || !expectingAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      expectingAgent = true;
    } else if (field === 'disallow' || field === 'allow') {
      if (!current) {
        current = { agents: ['*'], rules: [] };
        groups.push(current);
      }
      expectingAgent = false;
      current.rules.push({ allow: field === 'allow', path: value });
    }
  }
  return groups;
}

/** Strips scripts/styles/tags and collapses whitespace. Good enough to feed the LLM in v0. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
