import type { Config } from './config.ts';

/**
 * Minimal, polite page fetcher for v0: sets a descriptive UA, times out, and does a BASIC
 * robots.txt check (honours a `Disallow:` under a matching `User-agent:` group). This is not a
 * full RFC 9309 parser — it covers the common cases so we don't hammer a disallowed path. A
 * production crawler would use a hardened robots library + rate limiting (see README limitations).
 */

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  html: string;
  /** Plain-text distillation of the HTML, fed to the LLM. */
  text: string;
}

export async function fetchPage(url: string, config: Config): Promise<FetchedPage> {
  const target = new URL(url);
  const allowed = await robotsAllows(target, config);
  if (!allowed) {
    throw new Error(`robots.txt disallows fetching ${target.href} for our user-agent`);
  }
  const res = await timedFetch(target.href, config);
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${res.statusText} for ${target.href}`);
  }
  const html = await res.text();
  return {
    url: target.href,
    finalUrl: res.url || target.href,
    status: res.status,
    html,
    text: htmlToText(html),
  };
}

async function timedFetch(url: string, config: Config): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
  try {
    return await fetch(url, {
      redirect: 'follow',
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
    const res = await timedFetch(robotsUrl, config);
    if (res.status === 404 || res.status === 410) return true; // no robots = allowed
    if (!res.ok) return true; // unreadable robots — fail open, but we still set a UA
    body = await res.text();
  } catch {
    return true; // network hiccup fetching robots — don't block the run
  }
  return pathAllowed(body, target.pathname, config.userAgent);
}

/**
 * Tiny robots evaluator: collects rules from the group whose `User-agent` matches our UA token,
 * falling back to the `*` group, then applies the longest matching path prefix (Allow wins ties).
 */
export function pathAllowed(robotsTxt: string, path: string, userAgent: string): boolean {
  const uaToken = userAgent.split('/')[0]?.toLowerCase() ?? '';
  const groups = parseRobots(robotsTxt);
  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && uaToken.includes(a)));
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
