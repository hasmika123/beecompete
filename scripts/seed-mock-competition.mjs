/**
 * LOCAL DEV FIXTURE — one competition with every field on the detail page filled.
 *
 * Design work on `/c/[slug]` kept running into half-empty listings: a panel that looks fine with
 * three key dates falls apart with seven, and a section that never renders can't be judged at all.
 * This posts a listing that exercises EVERY branch the page has — long description, all six
 * key-date types (including a TBD row), a team-size range, both grade and age bounds, every
 * eligibility/judging/contact attribute, three award rows, four resources (one affiliate, one with
 * cover art), and five FAQs.
 *
 * NOT catalog data. The slug is `mock-` prefixed so it is obvious in the admin list and the URL,
 * and it points at localhost only. Never run this against staging or prod.
 *
 *   node scripts/seed-mock-competition.mjs            # create, or update in place if it exists
 *   node scripts/seed-mock-competition.mjs --delete   # archive it and stop
 *
 * Env: API_BASE_URL (default http://localhost:8080), ADMIN_API_TOKEN (default dev-admin-token —
 * what `./gradlew bootRun` sets locally).
 *
 * THE URL IS STABLE ACROSS RE-RUNS. Re-running UPDATES the existing fixture rather than replacing
 * it, so `/c/mock-all-fields` stays bookmarkable while you iterate on the data. That matters
 * because slugs are permanent even after archiving (D7) — an archive-and-recreate loop walks the
 * URL to `-2`, `-3`, … and invalidates the tab you are designing against. Children (key dates,
 * regions, resources, FAQs) are replaced wholesale on update: simpler than diffing, and their ids
 * are not referenced anywhere outside this fixture.
 */

const BASE = process.env.API_BASE_URL ?? 'http://localhost:8080';
const TOKEN = process.env.ADMIN_API_TOKEN ?? 'dev-admin-token';
const SLUG = 'mock-detail-page';

if (!/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE)) {
  console.error(`Refusing to run against ${BASE} — this fixture is local-only.`);
  process.exit(1);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api/v1/admin${path}`, {
    method,
    headers: {
      'X-Admin-Token': TOKEN,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

/** The live fixture, if a previous run left one — matched on the exact slug, not the -2/-3 strays. */
async function findExisting() {
  const page = await api(`/competitions?query=${encodeURIComponent('Cascadia')}&size=100`);
  return page.content.find((c) => c.slug === SLUG && c.archivedAt === null) ?? null;
}

/** Archive every fixture this script has ever made, including slug-suffixed strays. */
async function archiveAll() {
  const page = await api(`/competitions?query=${encodeURIComponent('Cascadia')}&size=100`);
  const live = page.content.filter((c) => c.slug.startsWith(SLUG) && c.archivedAt === null);
  for (const c of live) {
    await api(`/competitions/${c.id}`, { method: 'DELETE' });
    console.log(`archived ${c.slug}`);
  }
  return live.length;
}

/** Replace an edition's children wholesale (see the header note on why not a diff). */
async function replaceChildren(competitionId, editionId, { keyDates, regionIds, resources, faqs }) {
  for (const k of await api(`/editions/${editionId}/key-dates`)) {
    await api(`/key-dates/${k.id}`, { method: 'DELETE' });
  }
  for (const k of keyDates) {
    await api(`/editions/${editionId}/key-dates`, { method: 'POST', body: k });
  }
  await api(`/editions/${editionId}/regions`, { method: 'PUT', body: { regionIds } });

  for (const r of await api(`/competitions/${competitionId}/resources`)) {
    await api(`/resources/${r.id}`, { method: 'DELETE' });
  }
  for (const r of resources) {
    await api(`/competitions/${competitionId}/resources`, { method: 'POST', body: r });
  }

  for (const f of await api(`/competitions/${competitionId}/faqs`)) {
    await api(`/faqs/${f.id}`, { method: 'DELETE' });
  }
  for (const f of faqs) {
    await api(`/competitions/${competitionId}/faqs`, { method: 'POST', body: f });
  }
}

async function resolveOrganizer() {
  const name = 'Cascadia STEM Foundation';
  const found = await api(`/organizations?query=${encodeURIComponent(name)}&size=10`);
  const hit = found.content.find((o) => o.name === name && o.archivedAt === null);
  if (hit) return hit.id;
  const created = await api('/organizations', {
    method: 'POST',
    // VERIFIED so the detail page's trust panel renders its top rung — the state the design has
    // the least real data for.
    body: { name, type: 'HOST', domain: 'cascadiastem.example.org', verificationState: 'VERIFIED' },
  });
  return created.id;
}

async function main() {
  if (process.argv.includes('--delete')) {
    const n = await archiveAll();
    console.log(n ? 'fixture archived.' : 'nothing to archive.');
    return;
  }

  const existing = await findExisting();

  const categories = await api('/categories');
  const categoryId = categories.find((c) => c.slug === 'science-engineering').id;
  const regions = await api('/regions');
  const regionId = (name) => regions.find((r) => r.name === name).id;
  const organizerOrgId = await resolveOrganizer();

  const awards = [
    { title: 'Grand prize — national finals', type: 'monetary', value: 10000, currency: 'USD' },
    {
      title: 'Category winner (×6)',
      type: 'monetary',
      value: 2500,
      currency: 'USD',
      detail: 'One per project category.',
    },
    {
      title: 'Rising Researcher award',
      type: 'other',
      detail: 'Summer lab placement with a partner university.',
    },
  ];

  const body = {
    competition: {
      slug: SLUG,
      name: 'Cascadia Science & Innovation Challenge',
      categoryId,
      organizerOrgId,
      officialUrl: 'https://cascadiastem.example.org/challenge',
      logo: 'https://beecompete-public-assets.s3.us-east-1.amazonaws.com/covers/659c2ed3-7cc0-4797-9cba-27da39ec281e.jpg',
      description:
        'The Cascadia Science & Innovation Challenge asks high-school students to take an ' +
        'original research question from first sketch to defended result over a single school ' +
        'year. Teams register in the fall, submit a written research plan before winter, and ' +
        'spend the spring building, testing, and documenting their work. Regional judging ' +
        'happens in March across six project categories, and the top entries from each region ' +
        'advance to a two-day national finals where students present to a panel of working ' +
        'researchers and answer questions about their methods. Every finalist leaves with ' +
        'written feedback from three judges, and the challenge publishes an anonymized archive ' +
        'of past winning projects so the next cohort can see what a finished entry looks like.',
      tags: ['research', 'science fair', 'engineering design', 'poster session', 'mentorship'],
      participationMode: 'BOTH',
      teamSizeMin: 1,
      teamSizeMax: 3,
      delivery: 'HYBRID',
      entryPathway: 'SCHOOL_OR_CHAPTER',
      evaluationType: ['submission', 'live_performance', 'interview', 'portfolio'],
      minGrade: 9,
      maxGrade: 12,
      minAge: 13,
      maxAge: 18,
      costType: 'PAID',
      recurrence: 'ANNUAL',
      attributes: {
        // Standard bag keys (domain-model §3a) — every one the Overview tab can surface.
        eligible_countries: ['United States', 'Canada'],
        citizenship_countries: ['United States', 'Canada'],
        student_status_required: 'Enrolled full-time in grades 9–12 at the time of submission.',
        other_eligibility_requirements:
          'Projects involving vertebrate animals, human participants, or regulated substances ' +
          'need an approved research plan on file before experimentation begins.',
        syllabus: 'https://cascadiastem.example.org/challenge/handbook.pdf',
        topics: ['Biology', 'Chemistry', 'Earth & Environment', 'Engineering', 'Physics'],
        // Array, not prose: the template declares judging_criteria as string[] (migration 0015).
        judging_criteria: [
          'Research question and originality (25%)',
          'Method and rigor (30%)',
          'Analysis and interpretation of results (25%)',
          'Clarity of the written report and oral defense (20%)',
        ],
        tie_breakers:
          'Ties are broken first on the method-and-rigor score, then on the judges’ interview ' +
          'ranking, then by a full-panel revote.',
        rules_url: 'https://cascadiastem.example.org/challenge/rules',
        contact_email: 'challenge@cascadiastem.example.org',
        contact_phone: '+1 206 555 0142',
        // Category-specific keys from the science-engineering template.
        isef_affiliated: true,
        fair_levels: ['School', 'Regional', 'State', 'National'],
        project_categories: [
          'Animal Sciences',
          'Biomedical Engineering',
          'Chemistry',
          'Earth & Environmental Sciences',
          'Physics & Astronomy',
          'Robotics & Intelligent Machines',
        ],
      },
    },
    edition: {
      cycleLabel: '2026–27',
      scopeLevel: 'NATIONAL',
      registrationUrl: 'https://cascadiastem.example.org/challenge/register',
      entryFee: 45,
      currency: 'USD',
      ageCutoffDate: '2026-09-01',
      prizeSummary: 'Grand prize — national finals',
      prizeValue: 10000,
      prizeCurrency: 'USD',
      attributes: { awards, prize_display_mode: 'top_money' },
    },
    // All six milestone types, including one TBD row (R1-18) and one labelled CUSTOM — the two
    // states a timeline design is most likely to get wrong.
    keyDates: [
      { type: 'REG_OPEN', startsAt: '2026-09-08T12:00:00Z', timezone: 'America/Los_Angeles' },
      { type: 'REG_CLOSE', startsAt: '2026-11-14T07:59:00Z', timezone: 'America/Los_Angeles' },
      {
        type: 'CUSTOM',
        label: 'Research plan due',
        startsAt: '2026-12-12T07:59:00Z',
        timezone: 'America/Los_Angeles',
      },
      { type: 'SUBMISSION_DUE', startsAt: '2027-02-27T07:59:00Z', timezone: 'America/Los_Angeles' },
      // Multi-day: the timeline renders a date RANGE when endsAt falls on a later day. Nothing
      // in the create form can produce this (it posts endsAt: null) — only the per-edition
      // key-date manager and the API can, so the fixture is the only way to see that branch.
      {
        type: 'ROUND_START',
        startsAt: '2027-03-20T16:00:00Z',
        endsAt: '2027-03-21T23:00:00Z',
        timezone: 'America/Los_Angeles',
      },
      { type: 'RESULTS', startsAt: null, timezone: 'America/Los_Angeles' },
    ],
    regionIds: [
      regionId('Washington'),
      regionId('Oregon'),
      regionId('Idaho'),
      regionId('California'),
    ],
  };

  let created;
  let editionId;
  if (existing) {
    // Update in place: the spine and the edition keep their ids, so the slug — and the URL you
    // have open — survive. The fixture has exactly one edition, so index 0 is unambiguous.
    created = await api(`/competitions/${existing.id}`, { method: 'PUT', body: body.competition });
    editionId = (await api(`/competitions/${existing.id}/editions`))[0].id;
    await api(`/editions/${editionId}`, { method: 'PUT', body: body.edition });
  } else {
    // First run: one atomic call creates the competition, its edition, key dates and regions.
    created = await api('/competitions/with-edition', { method: 'POST', body });
    editionId = (await api(`/competitions/${created.id}/editions`))[0].id;
  }

  const resources = [
    {
      title: 'Research Design for Young Scientists',
      url: 'https://www.amazon.com/dp/0000000000?tag=beecompete-20',
      type: 'BOOK',
      isAffiliate: true,
      affiliateMeta: { network: 'amazon', tag: 'beecompete-20' },
      displayOrder: 0,
      imageUrl:
        'https://beecompete-public-assets.s3.us-east-1.amazonaws.com/covers/659c2ed3-7cc0-4797-9cba-27da39ec281e.jpg',
    },
    {
      title: 'Winning project archive, 2019–2026',
      url: 'https://cascadiastem.example.org/challenge/archive',
      type: 'PAST_PAPER',
      isAffiliate: false,
      displayOrder: 1,
    },
    {
      title: 'Writing the research plan: official guide',
      url: 'https://cascadiastem.example.org/challenge/research-plan-guide',
      type: 'GUIDE',
      isAffiliate: false,
      displayOrder: 2,
    },
    {
      title: 'What judges look for (12 min)',
      url: 'https://www.youtube.com/watch?v=00000000000',
      type: 'VIDEO',
      isAffiliate: false,
      displayOrder: 3,
    },
  ];

  const faqs = [
    {
      question: 'Can I enter on my own, or do I need a team?',
      answer:
        'Both work. Individual entries and teams of up to three are judged in the same categories, ' +
        'against the same criteria.',
      displayOrder: 0,
    },
    {
      question: 'Does my school have to register me?',
      answer:
        'A teacher or chapter advisor submits the roster, but students pick their own project and ' +
        'write their own plan. If your school has never participated, the organizer can set up a ' +
        'new site mid-season.',
      displayOrder: 1,
    },
    {
      question: 'What does the $45 entry fee cover?',
      answer:
        'Regional judging, the written feedback packet, and the project archive. Fee waivers are ' +
        'available and are not counted against a school’s entry limit.',
      displayOrder: 2,
    },
    {
      question: 'When are national finalists announced?',
      answer:
        'The organizer has not published the 2026–27 results date yet. It has historically landed ' +
        'in mid-April, about three weeks after regional judging.',
      displayOrder: 3,
    },
    {
      question: 'Can I continue a project I started last year?',
      answer:
        'Yes, as long as the entry documents what is new this year. Continuation projects are ' +
        'judged on the current year’s work only.',
      displayOrder: 4,
    },
  ];

  await replaceChildren(created.id, editionId, {
    keyDates: body.keyDates,
    regionIds: body.regionIds,
    resources,
    faqs,
  });

  console.log(`\n${existing ? 'updated' : 'created'} ${created.name}`);
  console.log(`  admin  /admin/competitions/${created.id}`);
  console.log(`  public /c/${created.slug}`);
  console.log(
    `  ${resources.length} resources · ${faqs.length} FAQs · ${body.keyDates.length} key dates · ` +
      `${awards.length} awards · ${body.regionIds.length} regions`,
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
