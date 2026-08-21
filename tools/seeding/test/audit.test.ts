import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyPage,
  describeFailure,
  isRootUrl,
  mapWithLimit,
  toCsv,
  type AuditRow,
} from '../src/audit.ts';

/** Enough competition vocabulary to clear PROGRAM_MIN_SIGNALS several times over. */
const COMPETITION_TEXT = `
  Registration for the 2026 contest opens in September. The submission deadline is November 3.
  Eligibility: students in grades 9-12. There is no entry fee. Read the official rules before you
  apply, and see how to enter below. Important dates are listed on this page.
`;

/** A real, healthy organization front door — no runnable competition on it. */
const ORG_HOMEPAGE_TEXT = `
  About us: our mission is to support educators nationwide. Become a member today. Donate to
  support our work. Meet our board of directors. Careers at the association. Latest news and our
  annual report are below.
`;

test('a deep page full of competition vocabulary is a PROGRAM page', () => {
  const { verdict, competitionSignals } = classifyPage({
    requestedUrl: 'https://example.org/contests/essay',
    finalUrl: 'https://example.org/contests/essay',
    text: COMPETITION_TEXT,
  });
  assert.equal(verdict, 'PROGRAM');
  assert.ok(competitionSignals.length >= 4, `signals: ${competitionSignals.join(', ')}`);
});

test('an org front door is HOMEPAGE even though the page is perfectly healthy', () => {
  // The NSDA shape from the 2026-08-20 sweep: nothing is broken, there is just no running to
  // extract, so the record would have published as a hidden zombie listing.
  const { verdict, homepageSignals } = classifyPage({
    requestedUrl: 'https://www.speechanddebate.org',
    finalUrl: 'https://www.speechanddebate.org/',
    text: ORG_HOMEPAGE_TEXT,
  });
  assert.equal(verdict, 'HOMEPAGE');
  assert.ok(homepageSignals.includes('membership'));
});

test('a single-competition org whose homepage IS the competition page reads as PROGRAM', () => {
  const { verdict } = classifyPage({
    requestedUrl: 'https://example.org',
    finalUrl: 'https://example.org/',
    text: COMPETITION_TEXT,
  });
  assert.equal(verdict, 'PROGRAM');
});

test('a deep link that redirects to the site root is HOMEPAGE, however rich the root looks', () => {
  // Strongest signal in the audit: the index named a page that no longer exists. Competition
  // vocabulary on the root must not rescue it — the running it described is gone.
  const { verdict, redirectedToRoot } = classifyPage({
    requestedUrl: 'https://example.org/2024-contest',
    finalUrl: 'https://example.org/',
    text: COMPETITION_TEXT,
  });
  assert.equal(verdict, 'HOMEPAGE');
  assert.equal(redirectedToRoot, true);
});

test('a reachable deep page with little competition evidence is THIN, not PROGRAM', () => {
  const { verdict } = classifyPage({
    requestedUrl: 'https://example.org/programs/overview',
    finalUrl: 'https://example.org/programs/overview',
    text: 'We run programs for young people across the country. Read more about our work.',
  });
  assert.equal(verdict, 'THIN');
});

test('isRootUrl treats a bare origin and an explicit slash alike, but not a query', () => {
  assert.equal(isRootUrl('https://example.org'), true);
  assert.equal(isRootUrl('https://example.org/'), true);
  assert.equal(isRootUrl('https://example.org/?utm_source=x'), false);
  assert.equal(isRootUrl('https://example.org/contest'), false);
  assert.equal(isRootUrl('not a url'), false);
});

test('mapWithLimit preserves input order regardless of completion order', async () => {
  const delays = [40, 5, 20, 0, 10];
  const out = await mapWithLimit(delays, 3, async (ms, i) => {
    await new Promise((r) => setTimeout(r, ms));
    return i;
  });
  assert.deepEqual(out, [0, 1, 2, 3, 4]);
});

test('CSV cells containing commas and quotes survive a round trip', () => {
  const row: AuditRow = {
    rank: 1,
    name: 'Regeneron ISEF, "the big one"',
    category: 'science-engineering',
    verdict: 'PROGRAM',
    requestedUrl: 'https://example.org/isef',
    finalUrl: 'https://example.org/isef',
    redirectedToRoot: false,
    competitionSignals: ['registration', 'deadline'],
    homepageSignals: [],
    problem: '',
  };
  const line = toCsv([row]).split('\n')[1]!;
  assert.ok(line.includes('"Regeneron ISEF, ""the big one"""'), line);
});

test('describeFailure surfaces the undici cause code behind a bare "fetch failed"', () => {
  // Regression from the first full run: 29 of 68 failures read only "fetch failed", which cannot
  // be triaged. ENOTFOUND means drop the row; an expired cert means the competition is alive.
  const err = new Error('fetch failed', { cause: { code: 'ENOTFOUND' } });
  assert.equal(describeFailure(err), 'ENOTFOUND (fetch failed)');
});

test('describeFailure leaves an already-specific message alone', () => {
  const err = new Error('fetch failed: 404 Not Found for https://example.org/gone');
  assert.match(describeFailure(err), /^fetch failed: 404 Not Found/);
  assert.equal(
    describeFailure(new Error('robots.txt disallows fetching https://example.org')),
    'robots.txt disallows fetching https://example.org',
  );
});

test('describeFailure drops the query string of a URL quoted in the message', () => {
  // A queue-it/Cloudflare challenge redirect carries a fresh high-entropy token every request.
  // Committed to the report it churns the file each run AND trips gitleaks as a generic-api-key.
  // The stand-in below is deliberately repetitive rather than random: a realistic-looking token
  // here would trip the very scanner this test exists to keep happy. The strip is length-agnostic.
  const err = new Error(
    'robots.txt disallows fetching https://x.queue-it.net/?c=y&enqueuetoken=EXAMPLE-EXAMPLE for our user-agent',
  );
  const out = describeFailure(err);
  assert.ok(!out.includes('enqueuetoken'), out);
  assert.ok(out.includes('https://x.queue-it.net/?…'), out);
  assert.ok(out.includes('for our user-agent'), out);
});

test('describeFailure keeps a URL that has no query string intact', () => {
  const err = new Error('fetch failed: 404 Not Found for https://example.org/gone');
  assert.equal(describeFailure(err), 'fetch failed: 404 Not Found for https://example.org/gone');
});
