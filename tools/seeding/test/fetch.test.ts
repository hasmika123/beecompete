import assert from 'node:assert/strict';
import { test } from 'node:test';
import { htmlToText, isPrivateHost, pathAllowed } from '../src/fetch.ts';
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

// L1: exact UA token matching — a group for "bot" must NOT capture BeeCompeteSeedingBot.
test('robots UA groups match by exact token, not substring', () => {
  const robots = 'User-agent: bot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\n';
  // Our token is "beecompeteseedingbot" — the "bot" group does not apply; wildcard does.
  assert.equal(pathAllowed(robots, '/anything', 'BeeCompeteSeedingBot/0.1'), true);
  assert.equal(pathAllowed(robots, '/private/x', 'BeeCompeteSeedingBot/0.1'), false);
  // An exact-token group DOES apply.
  const exact = 'User-agent: beecompeteseedingbot\nDisallow: /blocked\n';
  assert.equal(pathAllowed(exact, '/blocked/page', 'BeeCompeteSeedingBot/0.1'), false);
  assert.equal(pathAllowed(exact, '/open/page', 'BeeCompeteSeedingBot/0.1'), true);
});

// M5: SSRF guard — private/loopback/link-local literals are refused by default.
test('isPrivateHost flags loopback, private ranges, link-local, and localhost', () => {
  for (const host of [
    'localhost',
    'api.localhost',
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
    'fe80::1',
    'fd00::1',
  ]) {
    assert.equal(isPrivateHost(host), true, `${host} should be private`);
  }
  for (const host of ['example.org', 'beecompete.com', '8.8.8.8', '172.32.0.1', '2606:4700::1']) {
    assert.equal(isPrivateHost(host), false, `${host} should be public`);
  }
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

test('parseCsvUrls captures hint columns and drops "unknown" placeholders', () => {
  const csv =
    'name,organizer,category_slug,official_url,cost,participation\n' +
    'AMC 10,Mathematical Association of America,math,https://maa.org/amc,paid,individual\n' +
    'Mystery,unknown,science-engineering,https://x.example.org,unknown,team';
  const items = parseCsvUrls(csv);
  assert.deepEqual(items[0]!.hints, {
    name: 'AMC 10',
    organizer: 'Mathematical Association of America',
    categorySlug: 'math',
    cost: 'paid',
    participation: 'individual',
  });
  // "unknown" cells are treated as absent, not as facts.
  assert.deepEqual(items[1]!.hints, {
    name: 'Mystery',
    categorySlug: 'science-engineering',
    participation: 'team',
  });
});
