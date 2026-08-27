import { describe, expect, it } from 'vitest';
import {
  buildFaqs,
  buildFirstEdition,
  buildImportApprovalPayload,
  buildKeyDates,
  buildResources,
} from '@/lib/competition-payload';

// The awards rows (owner 2026-08-23) are the SOURCE; the edition's typed prize columns are
// derived. These tests pin the derivation contract the card + Awards tab depend on.

function form(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

const BASE = { edition_cycleLabel: '2027', edition_scopeLevel: 'NATIONAL' };

describe('buildFirstEdition — awards derivation', () => {
  it('derives summary from titles in display order and value from the LARGEST money award', () => {
    const awards = JSON.stringify([
      { title: 'Medals — regionals', type: 'non_monetary' },
      { title: 'National scholarship', type: 'scholarship', value: 10000, currency: 'USD' },
      { title: 'Runner-up', type: 'monetary', value: 2500, currency: 'USD' },
    ]);
    const edition = buildFirstEdition(form({ ...BASE, edition_awards: awards }));
    expect(edition.prizeSummary).toBe('Medals — regionals · National scholarship · Runner-up');
    expect(edition.prizeValue).toBe(10000);
    expect(edition.prizeCurrency).toBe('USD');
    expect((edition.attributes as { awards: unknown[] }).awards).toHaveLength(3);
  });

  it('sends null prize fields and NO attributes key when there are no awards', () => {
    const edition = buildFirstEdition(form(BASE));
    expect(edition.prizeSummary).toBeNull();
    expect(edition.prizeValue).toBeNull();
    // No key at all — on import-approve this object is spread over extras.edition, and an
    // extracted attributes bag must survive an empty awards editor.
    expect('attributes' in edition).toBe(false);
  });

  it('treats a malformed awards field as empty rather than failing the submit', () => {
    const edition = buildFirstEdition(form({ ...BASE, edition_awards: 'not-json' }));
    expect(edition.prizeSummary).toBeNull();
    expect('attributes' in edition).toBe(false);
  });
});

describe('buildFirstEdition — card-line modes (owner 2026-08-24)', () => {
  const awards = JSON.stringify([
    { title: 'Champion', type: 'monetary', value: 10000, currency: 'USD' },
    { title: 'Runner-up', type: 'monetary', value: 2500, currency: 'USD' },
    { title: 'Medals', type: 'trophy' },
  ]);

  it('top mode: summary is the FIRST award formatted, not the largest', () => {
    const e = buildFirstEdition(
      form({ ...BASE, edition_awards: awards, edition_awardsMode: 'top' }),
    );
    expect(e.prizeSummary).toBe('$10,000');
    expect(e.prizeValue).toBe(10000);
    expect((e.attributes as { prize_display_mode?: string }).prize_display_mode).toBe('top');
  });

  // The rows are hand-ordered so first place leads; a bigger number further down must NOT
  // override that (owner 2026-08-24 — "top award" = the row put first).
  it('top mode: a larger award listed below the first one does not win', () => {
    const outOfOrder = JSON.stringify([
      { title: 'Grand prize', type: 'monetary', value: 10000, currency: 'USD' },
      { title: 'Research scholarship', type: 'scholarship', value: 15000, currency: 'USD' },
    ]);
    const e = buildFirstEdition(
      form({ ...BASE, edition_awards: outOfOrder, edition_awardsMode: 'top' }),
    );
    expect(e.prizeSummary).toBe('$10,000');
    expect(e.prizeValue).toBe(10000);
  });

  // Text-based awards show their DETAIL, never their title — the mode promises a value.
  it('top mode: a non-money first row shows its detail, not its title', () => {
    const textFirst = JSON.stringify([
      { title: 'First place', type: 'certificate', detail: 'Certificate of national merit' },
      { title: 'Cash pool', type: 'monetary', value: 5000, currency: 'USD' },
    ]);
    const e = buildFirstEdition(
      form({ ...BASE, edition_awards: textFirst, edition_awardsMode: 'top' }),
    );
    expect(e.prizeSummary).toBe('Certificate of national merit');
    // The typed amount still comes from the first row that HAS one, so the strip stays populated.
    expect(e.prizeValue).toBe(5000);
  });

  it('top mode: a first row with neither value nor detail keeps its title', () => {
    const bare = JSON.stringify([{ title: 'Winner', type: 'trophy' }]);
    const e = buildFirstEdition(form({ ...BASE, edition_awards: bare, edition_awardsMode: 'top' }));
    expect(e.prizeSummary).toBe('Winner');
    expect(e.prizeValue).toBeNull();
  });

  it('total mode: sums only the top currency and says so', () => {
    const mixed = JSON.stringify([
      { title: 'US grand', type: 'monetary', value: 10000, currency: 'USD' },
      { title: 'US second', type: 'scholarship', value: 2500, currency: 'USD' },
      { title: 'EU side prize', type: 'monetary', value: 5000, currency: 'EUR' },
    ]);
    const e = buildFirstEdition(
      form({ ...BASE, edition_awards: mixed, edition_awardsMode: 'total' }),
    );
    expect(e.prizeSummary).toBe('$12,500 in prizes');
    expect(e.prizeValue).toBe(10000); // the lead money row's amount, in every mode
  });

  it('custom mode: the curator’s text wins; blank custom falls back to titles', () => {
    const withText = buildFirstEdition(
      form({
        ...BASE,
        edition_awards: awards,
        edition_awardsMode: 'custom',
        edition_awardsCustom: 'Up to $15,000 in prizes',
      }),
    );
    expect(withText.prizeSummary).toBe('Up to $15,000 in prizes');
    const blank = buildFirstEdition(
      form({ ...BASE, edition_awards: awards, edition_awardsMode: 'custom' }),
    );
    expect(blank.prizeSummary).toBe('Champion · Runner-up · Medals');
  });

  it('default titles mode stores NO prize_display_mode marker', () => {
    const e = buildFirstEdition(form({ ...BASE, edition_awards: awards }));
    expect('prize_display_mode' in (e.attributes as Record<string, unknown>)).toBe(false);
  });

  it('a custom line survives an empty rows editor (still no attributes key)', () => {
    const e = buildFirstEdition(
      form({ ...BASE, edition_awardsMode: 'custom', edition_awardsCustom: 'Prize pool TBA' }),
    );
    expect(e.prizeSummary).toBe('Prize pool TBA');
    expect('attributes' in e).toBe(false);
  });
});

describe('buildFirstEdition — multi-winner awards (owner 2026-08-26)', () => {
  // One award given six times ("best in each category") — a `count` on the row, not six rows.
  const perCategory = JSON.stringify([
    { title: 'Best in category', type: 'monetary', value: 2500, currency: 'USD', count: 6 },
    { title: 'Grand prize', type: 'monetary', value: 10000, currency: 'USD' },
  ]);

  it('total mode multiplies each award by its winner count', () => {
    const e = buildFirstEdition(
      form({ ...BASE, edition_awards: perCategory, edition_awardsMode: 'total' }),
    );
    expect(e.prizeSummary).toBe('$25,000 in prizes'); // 6 × 2,500 + 10,000
    // The lead row's amount stays PER WINNER — the strip's typed value is one award's worth.
    expect(e.prizeValue).toBe(2500);
  });

  it('top mode marks a multi-winner money award as per-winner ("each")', () => {
    const e = buildFirstEdition(
      form({ ...BASE, edition_awards: perCategory, edition_awardsMode: 'top' }),
    );
    expect(e.prizeSummary).toBe('$2,500 each');
  });

  it('titles fallback carries the count; non-money rows never say "each"', () => {
    const medals = JSON.stringify([
      { title: 'Finalist medal', type: 'trophy', detail: 'Medal + plaque', count: 20 },
    ]);
    const titles = buildFirstEdition(form({ ...BASE, edition_awards: medals }));
    expect(titles.prizeSummary).toBe('Finalist medal ×20');
    const top = buildFirstEdition(
      form({ ...BASE, edition_awards: medals, edition_awardsMode: 'top' }),
    );
    expect(top.prizeSummary).toBe('Medal + plaque');
  });
});

describe('buildImportApprovalPayload — attributes merge', () => {
  const extras = (edition: Record<string, unknown>) => JSON.stringify({ competition: {}, edition });

  it('form awards merge OVER extracted edition attributes without dropping either', () => {
    const f = form({
      ...BASE,
      import_extras: extras({ attributes: { fromExtraction: true } }),
      import_organizerName: '',
      name: 'X',
      slug: 'x',
      categoryId: 'c',
      organizerOrgId: 'o',
      participationMode: 'INDIVIDUAL',
      delivery: 'VIRTUAL',
      entryPathway: 'INDIVIDUAL',
      costType: 'FREE',
      recurrence: 'ANNUAL',
      edition_awards: JSON.stringify([{ title: 'Gold medal', type: 'non_monetary' }]),
    });
    const payload = buildImportApprovalPayload(f);
    const attrs = (payload.edition as { attributes: Record<string, unknown> }).attributes;
    expect(attrs.fromExtraction).toBe(true);
    expect((attrs.awards as unknown[]).length).toBe(1);
  });

  it('an extraction-only attributes bag survives an empty awards editor', () => {
    const f = form({
      ...BASE,
      import_extras: extras({ attributes: { fromExtraction: true } }),
      import_organizerName: '',
      name: 'X',
      slug: 'x',
      categoryId: 'c',
      organizerOrgId: 'o',
      participationMode: 'INDIVIDUAL',
      delivery: 'VIRTUAL',
      entryPathway: 'INDIVIDUAL',
      costType: 'FREE',
      recurrence: 'ANNUAL',
    });
    const payload = buildImportApprovalPayload(f);
    const attrs = (payload.edition as { attributes: Record<string, unknown> }).attributes;
    expect(attrs.fromExtraction).toBe(true);
  });
});

// The create form's extras step (2026-08-25) — rows post as indexed fields and the builders skip
// anything incomplete, so the always-seeded blank row can never post a half-filled entry.
describe('buildResources / buildFaqs', () => {
  it('keeps complete rows, skips incomplete ones, and renumbers displayOrder densely', () => {
    const f = form({
      resource_0_title: 'Past papers',
      resource_0_url: 'https://example.org/papers',
      resource_0_type: 'PAST_PAPER',
      resource_1_title: 'Missing URL — skipped',
      resource_1_url: '',
      resource_1_type: 'GUIDE',
      resource_2_title: 'Prep book',
      resource_2_url: 'https://example.org/book',
      resource_2_type: 'BOOK',
      resource_2_affiliate: 'on',
      resource_2_image: 'https://example.org/cover.jpg',
    });
    const rows = buildResources(f);
    expect(rows).toEqual([
      {
        title: 'Past papers',
        url: 'https://example.org/papers',
        type: 'PAST_PAPER',
        isAffiliate: false,
        affiliateMeta: null,
        displayOrder: 0,
        imageUrl: null,
      },
      {
        title: 'Prep book',
        url: 'https://example.org/book',
        type: 'BOOK',
        isAffiliate: true,
        affiliateMeta: null,
        displayOrder: 1, // dense — the skipped row leaves no hole
        imageUrl: 'https://example.org/cover.jpg',
      },
    ]);
  });

  it('an untouched blank row posts nothing', () => {
    const f = form({ resource_0_title: '', resource_0_url: '', resource_0_type: 'GUIDE' });
    expect(buildResources(f)).toEqual([]);
    const g = form({ faq_0_question: '', faq_0_answer: '' });
    expect(buildFaqs(g)).toEqual([]);
  });

  it('a question without an answer is an abandoned draft, not half a FAQ', () => {
    const f = form({
      faq_0_question: 'Who can enter?',
      faq_0_answer: 'Anyone enrolled in a US school.',
      faq_1_question: 'Half-typed?',
      faq_1_answer: '',
    });
    expect(buildFaqs(f)).toEqual([
      { question: 'Who can enter?', answer: 'Anyone enrolled in a US school.', displayOrder: 0 },
    ]);
  });
});

describe('buildKeyDates — multi-day rows', () => {
  const row = (extra: Record<string, string>) =>
    form({
      keydate_0_type: 'ROUND_START',
      keydate_0_date: '2027-03-20',
      keydate_0_time: '09:00',
      keydate_0_timezone: 'America/Los_Angeles',
      ...extra,
    });

  it('posts endsAt as end-of-day in the row’s zone', () => {
    const [date] = buildKeyDates(row({ keydate_0_enddate: '2027-03-21' }));
    expect(date?.startsAt).toBe('2027-03-20T16:00:00.000Z');
    // 23:59 on the 21st in Los Angeles (PDT, UTC-7) = 06:59Z on the 22nd.
    expect(date?.endsAt).toBe('2027-03-22T06:59:00.000Z');
  });

  it('omits endsAt when no end date is given', () => {
    const [date] = buildKeyDates(row({}));
    expect(date?.endsAt).toBeNull();
  });

  it('drops an end that is not after the start, rather than sending a 422', () => {
    // The server asserts endsAt > startsAt; the form shows an inline error for this, so the
    // payload must not carry the bad value through to a failed save.
    const [date] = buildKeyDates(row({ keydate_0_enddate: '2027-03-19' }));
    expect(date?.endsAt).toBeNull();
  });

  it('never posts an end for a TBD row — there is no start to measure it against', () => {
    const [date] = buildKeyDates(
      form({
        keydate_0_type: 'RESULTS',
        keydate_0_tbd: 'on',
        keydate_0_enddate: '2027-04-10',
        keydate_0_timezone: 'America/Los_Angeles',
      }),
    );
    expect(date?.startsAt).toBeNull();
    expect(date?.endsAt).toBeNull();
  });
});
