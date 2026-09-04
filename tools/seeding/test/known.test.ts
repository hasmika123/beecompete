import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Config } from '../src/config.ts';
import { checkKnown, decideKnown, describeKnown, type DuplicatesResponse } from '../src/known.ts';

const config: Config = {
  anthropicApiKey: undefined,
  anthropicModel: 'test',
  apiBase: 'http://api.test',
  adminToken: 'tok',
  userAgent: 'test',
  fetchTimeoutMs: 1000,
};

const live = { id: 'c1', slug: 'mathcounts', name: 'MATHCOUNTS', archivedAt: null };

test('decideKnown: a LIVE exact catalog match is "listed"; archived or similar-only is not', () => {
  const listed = decideKnown({
    catalog: [{ ...live, reasons: ['URL_EXACT'] }],
    pending: [],
  });
  assert.equal(listed?.kind, 'listed');
  assert.equal(
    decideKnown({
      catalog: [{ ...live, archivedAt: '2026-01-01', reasons: ['NAME_EXACT'] }],
      pending: [],
    }),
    null,
    'an archived listing is a curator question, not a skip',
  );
  assert.equal(
    decideKnown({ catalog: [{ ...live, reasons: ['NAME_SIMILAR'] }], pending: [] }),
    null,
    'a look-alike must never skip an extraction (AMC 8 vs AMC 10)',
  );
});

test('decideKnown: a pending twin is "pending", ranked below a live listing', () => {
  const pending = {
    importRecordId: 'r1',
    name: 'MATHCOUNTS',
    sourceUrl: null,
    reasons: ['URL_EXACT'] as const,
  };
  const only = decideKnown({ catalog: [], pending: [{ ...pending, reasons: ['URL_EXACT'] }] });
  assert.equal(only?.kind, 'pending');
  const both = decideKnown({
    catalog: [{ ...live, reasons: ['NAME_EXACT'] }],
    pending: [{ ...pending, reasons: ['URL_EXACT'] }],
  });
  assert.equal(both?.kind, 'listed');
  assert.match(describeKnown(only!), /import queue/);
  assert.match(describeKnown(both!), /--include-known/);
});

test('checkKnown: asks the duplicates endpoint with the URL + hint name and the admin token', async () => {
  let seen: { url: string; token: string | undefined } | undefined;
  const body: DuplicatesResponse = { catalog: [{ ...live, reasons: ['URL_EXACT'] }], pending: [] };
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    seen = { url: String(input), token: headers['x-admin-token'] };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  const verdict = await checkKnown(
    'https://www.mathcounts.org/programs',
    { name: 'MATHCOUNTS' },
    config,
    fetchImpl,
  );
  assert.equal(verdict && 'kind' in verdict ? verdict.kind : null, 'listed');
  assert.ok(seen);
  assert.equal(seen.token, 'tok');
  const url = new URL(seen.url);
  assert.equal(url.pathname, '/api/v1/admin/competitions/duplicates');
  assert.equal(url.searchParams.get('officialUrl'), 'https://www.mathcounts.org/programs');
  assert.equal(url.searchParams.get('name'), 'MATHCOUNTS');
});

test('checkKnown: a failed lookup is an error to report, never a skip and never a throw', async () => {
  const failing = (async () =>
    new Response('nope', { status: 500, statusText: 'Boom' })) as typeof fetch;
  const result = await checkKnown('https://x.example.org', undefined, config, failing);
  assert.ok(result && 'error' in result);
  assert.match(result.error, /500/);
  const noToken = await checkKnown('https://x.example.org', undefined, {
    ...config,
    adminToken: undefined,
  });
  assert.ok(noToken && 'error' in noToken);
});
