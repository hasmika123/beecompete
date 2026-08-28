import { describe, expect, it } from 'vitest';
import {
  ageLabel,
  categoryAttributeRows,
  deadlineFact,
  displayUrl,
  editionStatusLabel,
  entryFormatLabel,
  studentStatusLabel,
  prizeLabel,
  regOpensAt,
  scopeLabel,
  youtubeThumbnail,
} from '@/lib/detail-display';
import type { CompetitionDetail, EditionView } from '@/lib/catalog-types';

// #82 helpers. Minimal shapes: only the fields each helper reads.

const edition = (over: Partial<EditionView> = {}): EditionView =>
  ({ keyDates: [], ...over }) as EditionView;

const NOW = new Date('2026-08-18T00:00:00Z');
const kd = (type: string, startsAt: string | null) => ({
  type,
  label: null,
  startsAt,
  endsAt: null,
  timezone: 'America/New_York',
});

describe('regOpensAt', () => {
  it('returns the earliest FUTURE reg_open', () => {
    const eds = [
      edition({
        keyDates: [kd('reg_open', '2026-09-10T00:00:00Z'), kd('reg_open', '2026-09-01T00:00:00Z')],
      }),
    ];
    expect(regOpensAt(eds, NOW)?.iso).toBe('2026-09-01T00:00:00Z');
  });

  it('ignores past reg_open: registration already opened', () => {
    expect(
      regOpensAt([edition({ keyDates: [kd('reg_open', '2026-07-01T00:00:00Z')] })], NOW),
    ).toBeUndefined();
  });

  it('ignores TBD (null startsAt) reg_open', () => {
    expect(regOpensAt([edition({ keyDates: [kd('reg_open', null)] })], NOW)).toBeUndefined();
  });
});

describe('ageLabel', () => {
  const comp = (minAge: number | null, maxAge: number | null) =>
    ({ minAge, maxAge }) as CompetitionDetail;

  it('anchors the range to the cutoff date when present', () => {
    expect(ageLabel(comp(11, 14), edition({ ageCutoffDate: '2027-06-01' }))).toBe(
      '11–14 (as of Jun 1, 2027)',
    );
  });

  it('renders a bare range without a cutoff', () => {
    expect(ageLabel(comp(11, 14), edition())).toBe('11–14');
  });

  it('is undefined when the competition has no age gate', () => {
    expect(ageLabel(comp(null, null), edition({ ageCutoffDate: '2027-06-01' }))).toBeUndefined();
  });
});

describe('prizeLabel', () => {
  it('leads with the typed value and captions it with the summary', () => {
    expect(
      prizeLabel(edition({ prizeValue: 5000, prizeCurrency: 'USD', prizeSummary: 'Scholarships' })),
    ).toBe('$5,000 · Scholarships');
  });

  it('shows a whole-dollar amount without cents', () => {
    expect(prizeLabel(edition({ prizeValue: 5000, prizeCurrency: 'USD' }))).toBe('$5,000');
  });

  it('falls back to the summary, then Bragging rights', () => {
    expect(prizeLabel(edition({ prizeSummary: 'Medals' }))).toBe('Medals');
    expect(prizeLabel(edition())).toBe('Bragging rights');
  });
});

describe('editionStatusLabel', () => {
  it('labels every effective status the API can send', () => {
    expect(editionStatusLabel('open')).toBe('Open');
    expect(editionStatusLabel('upcoming')).toBe('Upcoming');
    expect(editionStatusLabel('ongoing')).toBe('In progress');
    expect(editionStatusLabel('closed')).toBe('Closed');
    expect(editionStatusLabel('archived')).toBe('Archived');
  });

  it('falls back to the raw token for an unknown status', () => {
    expect(editionStatusLabel('something_new')).toBe('something_new');
  });
});

// #89: the At-a-glance deadline cell pairs the relative value with the absolute date, so the
// relative wording can't hide WHEN the thing actually closes.
describe('deadlineFact', () => {
  const deadline = (iso: string) => ({ iso, kind: 'reg_close', timezone: 'America/New_York' });

  it('keeps the relative value and surfaces the date as a hint, inside the window', () => {
    expect(deadlineFact(deadline('2026-08-29T00:00:00Z'), NOW)).toEqual({
      value: '11 days to go',
      hint: 'Aug 28, 2026',
      urgent: false,
    });
  });

  it('marks an imminent deadline urgent, still with the date', () => {
    const fact = deadlineFact(deadline('2026-08-20T00:00:00Z'), NOW);
    expect(fact.urgent).toBe(true);
    expect(fact.hint).toBe('Aug 19, 2026');
  });

  it('adds NO hint beyond the window: the value is already the date', () => {
    expect(deadlineFact(deadline('2026-10-01T00:00:00Z'), NOW)).toEqual({
      value: 'Closes Sep 30, 2026',
      hint: undefined,
      urgent: false,
    });
  });

  // Calendar-day math happens in the DEADLINE's zone, not UTC (H1/M6): NOW is 2026-08-18T00:00Z,
  // which is still Aug 17 in New York — so an Aug-17-NY instant is "today" and Aug 18 is
  // "tomorrow". Both keep a hint; neither wording carries the date.
  it('says "Closes today" for a deadline later the same NY day', () => {
    const fact = deadlineFact(deadline('2026-08-18T02:00:00Z'), NOW);
    expect(fact.value).toBe('Closes today');
    expect(fact.urgent).toBe(true);
    expect(fact.hint).toBe('Aug 17, 2026');
  });
});

// #106: both the Details and About tabs read the attributes bag through these helpers.
describe('categoryAttributeRows', () => {
  it('humanizes keys word-by-word (NOT every letter) and drops eligibility keys', () => {
    expect(
      categoryAttributeRows({
        round_format: 'written exam',
        citizenship_countries: ['US'], // eligibility key — belongs to the Details tab
      }),
    ).toEqual([{ label: 'Round Format', value: 'written exam' }]);
  });

  it('renders arrays, booleans and numbers; skips empty and nested values', () => {
    expect(
      categoryAttributeRows({
        topics: ['algebra', 'geometry'],
        calculator_allowed: false,
        rounds: 3,
        blank: '',
        missing: null,
        nested: { a: 1 },
      }),
    ).toEqual([
      { label: 'Topics', value: 'algebra, geometry' },
      { label: 'Calculator Allowed', value: 'No' },
      { label: 'Rounds', value: '3' },
    ]);
  });

  it('returns nothing for a null bag', () => {
    expect(categoryAttributeRows(null)).toEqual([]);
  });

  // #108: the contact pair moved to the Logistics tab, so the More bin must stop showing it —
  // otherwise both tabs render the same two rows.
  it('drops the judging and logistics keys the designed tabs claim', () => {
    expect(
      categoryAttributeRows({
        fair_levels: ['Regional', 'State'],
        judging_criteria: 'originality', // Judging tab
        tie_breakers: 'earliest submission', // Judging tab
        rules_url: 'https://example.org/rules', // Judging tab, as a link
        contact_email: 'hello@example.org', // Logistics tab, as a mailto:
        contact_phone: '+1 206 555 0142', // Logistics tab, as a tel:
      }),
    ).toEqual([{ label: 'Fair Levels', value: 'Regional, State' }]);
  });
});

// #108. Scope is `Edition.scopeLevel`, public tokens = the lowercased ScopeLevel enum.
describe('scopeLabel', () => {
  it('labels every scope token', () => {
    expect(scopeLabel('international')).toBe('International');
    expect(scopeLabel('national')).toBe('National');
    expect(scopeLabel('state')).toBe('Statewide');
    expect(scopeLabel('regional')).toBe('Regional');
    expect(scopeLabel('local')).toBe('Local');
    // Worded apart from DELIVERY_LABELS.virtual ("Online") on purpose — both rows can render
    // side by side on the Logistics tab.
    expect(scopeLabel('virtual')).toBe('Online — no fixed region');
  });

  it('passes an unknown token through rather than rendering blank', () => {
    expect(scopeLabel('galactic')).toBe('galactic');
  });
});

// --- #111 Logistics rows ----------------------------------------------------------------------
// Participation + team size render as ONE row, so the compose has to hold every mode/bounds combo.

const base = {
  participationMode: 'both',
  teamSizeMin: 1,
  teamSizeMax: 3,
} as CompetitionDetail;

describe('entryFormatLabel', () => {
  it('puts the bounds in parentheses after a capitalised mode', () => {
    expect(entryFormatLabel(base)).toBe('Individual or Team (1–3)');
    expect(entryFormatLabel({ ...base, participationMode: 'team' } as CompetitionDetail)).toBe(
      'Team (1–3)',
    );
    expect(
      entryFormatLabel({ ...base, participationMode: 'individual' } as CompetitionDetail),
    ).toBe('Individual');
  });

  it('degrades to the bare mode when bounds are absent — never "Team (null)"', () => {
    const noBounds = { ...base, teamSizeMin: null, teamSizeMax: null } as CompetitionDetail;
    expect(entryFormatLabel(noBounds)).toBe('Individual or Team');
    expect(entryFormatLabel({ ...noBounds, participationMode: 'team' } as CompetitionDetail)).toBe(
      'Team',
    );
  });

  it('handles a one-sided bound', () => {
    expect(
      entryFormatLabel({ ...base, teamSizeMin: null, teamSizeMax: 4 } as CompetitionDetail),
    ).toBe('Individual or Team (up to 4)');
    expect(
      entryFormatLabel({ ...base, teamSizeMin: 2, teamSizeMax: null } as CompetitionDetail),
    ).toBe('Individual or Team (2 or more)');
  });
});

describe('studentStatusLabel', () => {
  it('states the requirement rather than answering yes/no', () => {
    expect(studentStatusLabel(true)).toBe('Required');
    expect(studentStatusLabel(false)).toBe('Not required');
  });

  it('omits the row when the key is absent', () => {
    expect(studentStatusLabel(undefined)).toBeNull();
    expect(studentStatusLabel(null)).toBeNull();
  });

  it('falls back to the generic renderer for a non-boolean', () => {
    // `0022` retyped this key to boolean, so a string here means a stale or hand-edited bag —
    // show it rather than dropping curated text on the floor.
    expect(studentStatusLabel('enrolled full-time')).toBe('enrolled full-time');
  });
});

describe('displayUrl', () => {
  it('strips scheme, www and a trailing slash but keeps the whole path', () => {
    expect(displayUrl('https://www.example.org/challenge/register/')).toBe(
      'example.org/challenge/register',
    );
    expect(displayUrl('http://sub.example.org/a/b?c=d')).toBe('sub.example.org/a/b?c=d');
  });

  it("never truncates — shortening is the layout's job, so a copied link stays real", () => {
    const long = `https://example.org/${'a'.repeat(120)}`;
    expect(displayUrl(long)).toHaveLength(long.length - 'https://'.length);
  });
});

// Derived from the id in the resource's own URL (owner 2026-08-28) — a pure function of the link,
// so it never needs a fetch, an API key, or a model's guess. The id pattern is the security
// boundary: this builds a URL from caller-supplied text.
describe('youtubeThumbnail', () => {
  const THUMB = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg';

  it('reads the id from every shape a YouTube link takes', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ]) {
      expect(youtubeThumbnail(url), url).toBe(THUMB);
    }
  });

  it('is undefined for anything that is not a YouTube video', () => {
    for (const url of [
      'https://example.org/watch?v=dQw4w9WgXcQ', // right shape, wrong host
      'https://www.youtube.com/@somechannel', // a channel, not a video
      'https://www.youtube.com/', // no id at all
      'not a url',
      '',
      null,
      undefined,
    ]) {
      expect(youtubeThumbnail(url as string | null | undefined), String(url)).toBeUndefined();
    }
  });

  it('refuses an id that is not exactly 11 valid characters', () => {
    // The guard that keeps arbitrary pasted text out of an image URL we render.
    expect(youtubeThumbnail('https://youtu.be/short')).toBeUndefined();
    expect(youtubeThumbnail('https://youtu.be/waaaaaaaaaaaaytoolong')).toBeUndefined();
    expect(youtubeThumbnail('https://youtu.be/bad!!chars$')).toBeUndefined();
    expect(youtubeThumbnail('https://www.youtube.com/watch?v=../../etc/pw')).toBeUndefined();
  });

  it('ignores a non-http scheme even on a YouTube host', () => {
    expect(
      youtubeThumbnail('javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ'),
    ).toBeUndefined();
  });
});
