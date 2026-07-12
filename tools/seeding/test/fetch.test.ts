import assert from 'node:assert/strict';
import { test } from 'node:test';
import { htmlToText, pathAllowed } from '../src/fetch.ts';
import { parseCsvUrls } from '../src/input.ts';

test('htmlToText strips scripts/styles/tags and decodes basic entities', () => {
  const text = htmlToText(
    '<style>.x{}</style><script>bad()</script><h1>Grades 6&ndash;8</h1><p>Fee &amp; rules</p>',
  );
  assert.ok(!text.includes('bad()'));
  assert.ok(!text.includes('.x{}'));
  assert.ok(text.includes('Grades 6'));
  assert.ok(text.includes('Fee & rules'));
});

test('robots pathAllowed blocks a disallowed prefix and allows others', () => {
  const robots = 'User-agent: *\nDisallow: /private\n';
  assert.equal(pathAllowed(robots, '/private/page', 'BeeCompeteSeedingBot/0.1'), false);
  assert.equal(pathAllowed(robots, '/public/page', 'BeeCompeteSeedingBot/0.1'), true);
});

test('robots pathAllowed: Allow overrides a broader Disallow (longest match wins)', () => {
  const robots = 'User-agent: *\nDisallow: /\nAllow: /competitions\n';
  assert.equal(pathAllowed(robots, '/competitions/nova', 'Bot/1'), true);
  assert.equal(pathAllowed(robots, '/admin', 'Bot/1'), false);
});

test('parseCsvUrls reads a URL column regardless of position', () => {
  const csv =
    'name,official_url,category\nNova,https://a.example.org,math\nOrbit,https://b.example.org,robotics';
  const items = parseCsvUrls(csv);
  assert.deepEqual(
    items.map((i) => i.source),
    ['https://a.example.org', 'https://b.example.org'],
  );
});

test('parseCsvUrls throws when no URL column is present', () => {
  assert.throws(() => parseCsvUrls('name,category\nNova,math'));
});
