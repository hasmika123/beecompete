// Per-category display copy (R1-6): one-liners for hubs/tiles and the indexable
// "About [category] competitions" SEO block (blueprints decision #16). Content lives in code
// at R1 — the Category table deliberately carries no copy fields (taxonomy is seed config,
// domain-model); if curators ever need to edit these, they move to the DB then. Keyed by the
// R1-2 seeded slugs; `other` is the fallback.

export interface CategoryContent {
  slug: string;
  name: string;
  oneLiner: string;
  about: string;
}

export const CATEGORY_CONTENT: CategoryContent[] = [
  {
    slug: 'math',
    name: 'Math',
    oneLiner: 'Contests from school math leagues to national olympiads.',
    about:
      'Math competitions span everything from friendly school-level leagues to the national olympiad pipeline. Most run annually with school-year registration windows, and many are the first competition a student ever enters. Formats range from timed multiple-choice exams to full proof-based rounds, so there is a fit for every level — from a 3rd grader who loves puzzles to a senior chasing an olympiad invite.',
  },
  {
    slug: 'science-engineering',
    name: 'Science & Engineering',
    oneLiner: 'Science fairs, olympiads, and engineering challenges.',
    about:
      'Science and engineering competitions include research-project fairs, knowledge olympiads, and hands-on design challenges. Fair-track events usually progress from school to regional to state or national rounds, while olympiad-style events test lab skills and theory. Many offer significant scholarships and are a strong signal of sustained, self-driven work.',
  },
  {
    slug: 'computer-science',
    name: 'Computer Science & Coding',
    oneLiner: 'Programming contests, hackathons, and app challenges.',
    about:
      'Coding competitions range from algorithmic contests judged on speed and correctness to hackathons and app-building challenges judged on creativity and impact. Most accept beginners, many run online, and several offer year-round practice platforms — a low-friction way for a student to turn an interest in programming into a track record.',
  },
  {
    slug: 'robotics',
    name: 'Robotics',
    oneLiner: 'Team robotics leagues and build-season challenges.',
    about:
      'Robotics competitions are almost always team events built around a season: a game is announced, teams design and build robots, then compete at qualifiers that advance toward championship events. They reward engineering, programming, teamwork, and fundraising alike — and most leagues have entry levels spanning elementary through high school.',
  },
  {
    slug: 'debate-speech',
    name: 'Debate & Speech',
    oneLiner: 'Debate formats, speech events, and mock government.',
    about:
      'Debate and speech competitions cover structured debate formats, individual speaking events, and simulations like mock trial and model government. Most run through school teams with weekend tournaments across the school year, building research, argumentation, and public-speaking skills that show up everywhere later.',
  },
  {
    slug: 'business-entrepreneurship',
    name: 'Business & Entrepreneurship',
    oneLiner: 'Pitch competitions, business plans, and career-club events.',
    about:
      'Business competitions include pitch contests, business-plan challenges, stock-market simulations, and the big career-and-technical student organization event circuits. They are often team-based, frequently include real prize money or seed funding, and give students an early portfolio of real-world projects.',
  },
  {
    slug: 'writing-essay',
    name: 'Writing & Essay',
    oneLiner: 'Essay prizes, poetry, journalism, and creative writing.',
    about:
      'Writing competitions span essay prizes on set topics, poetry and short fiction contests, and journalism awards. Most are individual, submission-based, and free to enter — one of the most accessible competition categories, with several nationally recognized awards that carry weight in admissions.',
  },
  {
    slug: 'arts-music',
    name: 'Arts & Music',
    oneLiner: 'Visual arts, music performance, film, and design.',
    about:
      'Arts and music competitions include juried visual-art exhibitions, music performance festivals and concerto competitions, film festivals, and design challenges. Judging is portfolio- or performance-based, and many offer scholarships or public showcases of student work.',
  },
  {
    slug: 'academic-bowl',
    name: 'Academic Bowl & Quiz',
    oneLiner: 'Quiz bowl, knowledge bowls, and buzzer competitions.',
    about:
      'Academic bowl competitions are fast-paced team quiz events played on buzzers across every subject. Schools field teams for local and regional tournaments that qualify toward national championships — a great fit for broadly curious students who like playing as a team.',
  },
  {
    slug: 'history-geography-civics',
    name: 'History, Geography & Civics',
    oneLiner: 'History days, geography bees, and civics challenges.',
    about:
      'This category covers research-project events like history days, knowledge bees in geography and history, and civics competitions built around government and constitutional knowledge. Many progress from school to state to national rounds and pair well with humanities-leaning students.',
  },
  {
    slug: 'other',
    name: 'Other',
    oneLiner: 'Everything that does not fit a lane — yet.',
    about:
      'Competitions that span subjects or defy the usual categories: interdisciplinary challenges, general talent searches, and new formats we have not given a lane of their own yet.',
  },
];

export function categoryContent(slug: string): CategoryContent | undefined {
  return CATEGORY_CONTENT.find((c) => c.slug === slug);
}

/** Grade quick-chip bands (blueprints decision #11): coarse one-tap narrowing. */
export const GRADE_BANDS = [
  { key: 'elementary', label: 'Elementary', minGrade: -1, maxGrade: 5 },
  { key: 'middle', label: 'Middle School', minGrade: 6, maxGrade: 8 },
  { key: 'high', label: 'High School', minGrade: 9, maxGrade: 12 },
] as const;
