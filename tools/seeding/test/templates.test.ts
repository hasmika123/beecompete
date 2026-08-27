import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORY_TEMPLATES } from '../src/categories.ts';
import type { Config } from '../src/config.ts';
import { diffTemplateKeys, resolveTemplates, type TemplateMap } from '../src/templates.ts';

// Category Templates come from the SERVER on a real run; the checked-in mirror is the fallback.
// These cover the paths that DON'T need a network — the fallbacks and the diff — because those
// are the ones that run silently and decide how much the extraction prompt knows about.

const CONFIG = { apiBase: 'http://localhost:9', adminToken: 'test-token' } as Config;

function mapWith(mathKeys: string[]): TemplateMap {
  return {
    ...(CATEGORY_TEMPLATES as TemplateMap),
    math: { type: 'object', properties: Object.fromEntries(mathKeys.map((k) => [k, {}])) },
  };
}

test('diffTemplateKeys reports keys the mirror is missing', () => {
  const mirror = mapWith(['topics']);
  const server = mapWith(['topics', 'contact_phone']);
  const diff = diffTemplateKeys(mirror, server);
  assert.equal(diff.length, 1);
  assert.match(diff[0]!, /^math: mirror is MISSING contact_phone$/);
});

test('diffTemplateKeys reports stale keys the server dropped', () => {
  const diff = diffTemplateKeys(mapWith(['topics', 'gone']), mapWith(['topics']));
  assert.equal(diff.length, 1);
  assert.match(diff[0]!, /^math: mirror has stale gone$/);
});

test('diffTemplateKeys is silent when the two agree', () => {
  assert.deepEqual(diffTemplateKeys(mapWith(['topics']), mapWith(['topics'])), []);
});

test('an --offline run uses the mirror and says so', async () => {
  const r = await resolveTemplates(CONFIG, true);
  assert.equal(r.source, 'mirror');
  assert.equal(r.templates, CATEGORY_TEMPLATES);
  // The warning is the entire safety net here: a stale mirror produces a narrower prompt, which
  // looks exactly like "the page didn't say" in the output. Silence would be the bug.
  assert.ok(r.notes.some((n) => /CHECKED-IN MIRROR \(offline run\)/.test(n)));
});

test('a run with no admin token falls back rather than failing', async () => {
  const r = await resolveTemplates({ ...CONFIG, adminToken: undefined } as Config, false);
  assert.equal(r.source, 'mirror');
  assert.ok(r.notes.some((n) => /no ADMIN_API_TOKEN/.test(n)));
});

test('an unreachable API falls back rather than aborting the run', async () => {
  // Port 9 (discard) with nothing listening — a connection failure, not a 4xx.
  const r = await resolveTemplates(CONFIG, false);
  assert.equal(r.source, 'mirror');
  assert.ok(r.notes.some((n) => /could not reach/.test(n)));
});
