# Seeding artifacts — `docs/seeding/`

This folder holds the **content-seeding artifacts** for BeeCompete's catalog. It is the output of
the **S2 — Master Index** task in `docs/phase-1-plan.md` (the "Data seeding & catalog readiness"
workstream) and the input to **S3** (AI-assisted extraction) and **S4** (human curation sprints).

Code alone does not make R1 launchable — the **catalog** does. This long-list is the raw demand map
that the extraction pipeline and curators work down, in rank order, until the R1 content gate is met.

## What's here

| File | Purpose |
|---|---|
| `master-index.csv` | Machine-readable long-list — one row per competition, ranked. The S3 pipeline reads this. |
| `master-index.md` | Human-readable companion — per-category tables + a coverage summary. |
| `README.md` | This file — provenance, methodology, column definitions, and how S3/S4 consume it. |
| `paste-json-prompt.md` | **Manual “give me the JSON” prompt** — for adding ONE competition by hand via Admin → Competitions → New → Paste JSON. Keep its field rules in step with `tools/seeding/src/prompt.ts`. |
| `url-audit.csv` | **URL-quality snapshot** (2026-08-20) — one verdict per distinct `official_url`. Regenerate with `pnpm --dir tools/seeding audit-index`. See "URL quality" below. |

## How S3 / S4 consume it

1. **S3 (extraction)** walks `master-index.csv` **top-down by `rank_composite`**. For each row it
   fetches the `official_url`, and an LLM extracts the Spine fields into JSON **validated against the
   Category Template JSON Schema** (R1-2 `CategoryAttributeValidator`). The record lands in the R1-3
   import-review queue with `provenance.source = import` and a confidence score.
2. **S4 (curation)** reviews/approves every imported record before publish. The `rank_composite`
   ordering means curators spend their first, freshest passes on the highest-demand competitions —
   the **top ~50 by expected search volume** that carry the R1 SEO thesis.
   **The review surface is `/admin/import-records` (rebuilt 2026-08-21, architecture.md §13a).**
   Opening a record shows the **same form used to add a competition by hand**, pre-filled from the
   extraction — spine, first edition, timeline, regions and category attributes — with the raw
   payload one tab away for anything the form has no field for. What matters for planning a run:
   - The queue **lists what's missing before you open a row** — category, organizer, edition cycle,
     the deadline the public card would show, a confidence meter, and the **duplicate flags** (DQ4,
     2026-09-03): **already listed** (a live listing has the same name), **slug taken**, **same URL
     as a listing**, **listed before (archived)**, plus **also pending ×N** when other queued
     records look like the same competition — so two people who queued the same page see each
     other before either approves. Filter by origin, search the payload (name/slug/organizer/source
     URL), and sort by confidence to work the weakest extractions first (or the strongest, for a
     fast bulk pass).
   - **Bulk approve/reject** decides many selected rows at once. Each is decided independently, so a
     bad one can't take the batch with it; failures come back named and stay pending. Use it for a
     run whose extractions are uniformly good, or to clear a bad source in one gesture — it skips
     the per-record form by design. **Rows carrying a duplicate flag are left out of a bulk
     approve** (bulk can't carry the "not a duplicate" confirmation only the review form can give);
     bulk *reject* still takes them, which is usually what a duplicate deserves.
   - **Approving a possible duplicate.** A live listing with the same normalized name is a hard
     stop — rename it in the form or reject the record. Same URL / similar name / archived
     same-name is a warning with the candidates listed; tick **"I checked — this is not a
     duplicate"** in the form to approve anyway (umbrella programs like AMC 8/10/12 need exactly
     this).
   - Approving stays **lenient on purpose**: an extraction can only state what the page stated, so
     only name/slug/category/organizer block approval. The completeness ring shows what a full
     listing would still need, and says so without blocking.
3. The columns here are **hints, not truth**. S3 re-extracts from the official page and S4 verifies;
   anything marked `unknown` here is simply left for the pipeline to fill. **Never treat a value in
   this file as verified** — it is a starting point for the demand ranking, not curated data.

## The R1 content gate this feeds (from `phase-1-plan.md`)

- **≥ 200 competitions live at launch**, spanning **all 11 seed categories** (**≥ 15 each** for the
  major ones).
- Every live listing has a **current or upcoming Edition with verified dates**.
- The **top ~50 by expected search volume** get a full spine + curated resources.

This long-list deliberately **over-supplies** that gate (448 rows after the 2026-07-29 S2b/S2c
extensions) so that attrition during extraction and verification (dead pages, defunct programs,
thin editions) still leaves ≥ 200 live.

### Intentional multi-row programs (S3 dedup note)

A few umbrella programs are **deliberately split across rows/categories** because they serve
distinct demand lanes. S3 must treat each group as **one source page** (extract once, then fan out),
not as independent competitions:

- **Scholastic Art & Writing Awards** — `(Art)` row in `arts-music` + `(Writing)` row in
  `writing-essay`; both point at `artandwriting.org`.
- **YoungArts** — the umbrella `National YoungArts Foundation` row (`arts-music`) plus the
  `Writing disciplines` (`writing-essay`) and `dance discipline` (`arts-music`) rows; all point at
  `youngarts.org`.

Other same-URL row groups (e.g. the MAA AMC family, NSDA events, VFW Patriot's Pen / Voice of
Democracy) are genuinely distinct competitions that share an organizer homepage.

### Known-listing pre-check (DQ4, 2026-09-03)

Before fetching an item, the S3 tool asks the API's duplicate detection
(`GET /api/v1/admin/competitions/duplicates`) with the page URL and the index-hint name. An item
that is **already a live listing** (same name key or URL key) or **already pending in the queue**
is reported as `SKIPPED` with the match named — no fetch, no LLM call, no second queue row. It
runs only when the tool can reach the API (`ADMIN_API_TOKEN` set, not `--offline`); a failed
lookup is a warning on the item, never a skip. `--include-known` extracts regardless (a deliberate
re-extraction after a prompt fix). Similar-but-not-exact names are **never** skipped here — that
is a curator's call on the review page, and skipping over a look-alike would silently drop real
competitions (AMC 8 vs AMC 10). Re-running the same batch is therefore cheap and safe: everything
already handled is skipped, only new rows spend an extraction.

## URL quality — read this before planning a bulk extraction run

`official_url` is the ceiling on everything S3 can extract. The **first live sweep (2026-08-20)**
made that concrete: the NSDA row points at the organization's front door, so the extractor found no
running at all and the record would have published as a hidden listing. So the whole index is now
audited **before** LLM spend, by `tools/seeding/src/audit.ts` (no LLM calls — a keyword heuristic
over the same distilled text the extractor sees):

```bash
pnpm --dir tools/seeding audit-index          # whole index -> docs/seeding/url-audit.csv
pnpm --dir tools/seeding audit-index --limit 50
```

| Verdict | Means | What S3/S4 should do |
|---|---|---|
| `PROGRAM` | Reads like a competition page | Extract as-is |
| `THIN` | Reachable deep page, little competition vocabulary | Glance at it before extracting |
| `HOMEPAGE` | An org front door (or a deep link that now redirects to one) | **Find the program page first** — extraction yields a thin record, often with no edition |
| `UNREACHABLE` | Dead, bot-blocked, robots-disallowed, or not HTML | Re-source or drop the row |

Verdicts are **triage, not truth** — the same standing rule as the index's own columns. A `HOMEPAGE`
row is not worthless: in the 5-page sweep, Scholastic (a `HOMEPAGE`) still produced an edition,
while NSDA did not.

### The 2026-08-20 baseline, and the top-50 curation pass

448 index rows collapse to ~425 distinct URLs (umbrella programs share a page). The first audit
found the index in worse shape than the row count suggests; a hand-curation pass over the top 50 by
`rank_composite` then followed, replacing 31 URLs with pages verified by the classifier:

| Verdict | Baseline | After the top-50 pass |
|---|---:|---:|
| `PROGRAM` | 88 (21%) | **112 (26%)** |
| `THIN` | 74 (17%) | 72 (17%) |
| `HOMEPAGE` | 194 (46%) | 176 (41%) |
| `UNREACHABLE` | 68 (16%) | 65 (15%) |
| **readable content** (`PROGRAM` + `THIN`) | **162 of 424** | **184 of 425** |

Within the **top 50** — the rows curators touch first, and the ones carrying the R1 SEO thesis — the
change is the whole point: **12 → 35 program pages**, and 40 of 50 now point at readable competition
content (was 18).

Three things the baseline established, which the curation pass did not change:

1. **The over-supply assumption needs re-reading.** The index was sized so attrition still leaves
   ≥ 200 live. That holds by *row count*, but only 184 URLs currently point at readable competition
   content — before any curation attrition. The remaining `HOMEPAGE` rows are recoverable, not lost;
   each needs a human to find the real program URL, exactly as the top 50 did.
2. **`HOMEPAGE` is an index-construction artifact, not link rot.** 192 of the original 194 were
   recorded as bare origins during S2; only 2 were deep links that had since died. Fixing this is
   editing the index, not chasing broken sites.
3. **Coverage is uneven by category.** `writing-essay` is in good shape (20 `PROGRAM` of 33);
   `science-engineering` is the worst (40 `HOMEPAGE` of 77), and `computer-science` still has more
   unreachable rows (9) than program pages (4). The categories with a ≥ 15-listing gate are not
   equally close to it.

Of the ~65 `UNREACHABLE`: about 40 are genuinely gone (24 × HTTP 404, 16 × `ENOTFOUND` — a `www.`
prefix flip recovers only one of them, so they are dead domains, not typos), 8 have broken TLS
(expired / mismatched / self-signed certs — the competition is alive, the fetch is not), 8 are 403
bot-blocks, **5 are `robots.txt`-disallowed**, and the rest are transient.

> **The `robots.txt`-disallowed rows must not be extracted at all** — not by a retry, not by a
> different user-agent. Filter the CSV on `problem` containing `robots.txt` to see them. If a
> listing there matters, ask the organizer for permission or curate it by hand.

### What hand-curation looks like (and what it can't fix)

The top-50 pass replaced a URL only when the replacement was **fetched and classified first** —
never guessed. The method: harvest the org homepage's own links, rank the ones whose path or anchor
text reads like a competition page, fetch the top candidates, and take the best verified one that is
*also* the page a student should land on. Where the program page beat a rules/dates page on
semantics but lost on signal count, semantics won: `official_url` is a user-facing link, not just an
extraction source.

**Ten of the top 50 could not be fixed by editing a URL**, and each now carries a `URL AUDIT:` note
in the index's `notes` column so nobody re-investigates from scratch:

| Reason | Rows |
|---|---|
| `robots.txt` disallows crawling — never extract | CyberPatriot, Technovation Girls |
| 403 bot-block (the URL is fine, our fetcher is not welcome) | NAQT HSNCT |
| Every path redirect-loops against our fetcher | National Merit Scholarship Program |
| Subpages 403 behind Cloudflare | picoCTF |
| No page with real competition detail exists to point at | USAD, 3M Young Scientist Challenge, America's Battle of the Books, ARML |
| Structural: one org page serves many competitions | the nine NSDA event rows (Lincoln-Douglas, Public Forum, …) — these are events *within* one tournament, which is a modelling question, not a URL defect |

Those need manual entry or an organizer conversation, which is the same conclusion
`phase-1-plan.md` already reached for bot-blocked sites.


## Ranking methodology

Each competition is scored on **three axes, 1–5 each**, then combined into a weighted composite. The
composite drives the order S3/S4 work the list.

| Axis | Column | 5 = | 1 = |
|---|---|---|---|
| **Search volume / name recognition** | `search_volume_score` | Household-name national program (AMC, Science Olympiad, FIRST, Scholastic, Spelling Bee) | Niche/regional, little organic search demand |
| **Category-coverage value** | `coverage_score` | Fills a thin category or a distinct sub-lane / grade band we'd otherwise miss | Redundant with many similar entries already on the list |
| **Upcoming-deadline proximity** | `deadline_proximity_score` | Registration/entry deadline is imminent or rolling year-round (act now) | Deadline just passed / far off, or unknown |

**Composite formula** (weights reflect the R1 SEO thesis — demand first):

```
rank_composite = round( 0.50 * search_volume_score
                      + 0.30 * coverage_score
                      + 0.20 * deadline_proximity_score , 2 )
```

Higher = seed sooner. Ties are broken by `search_volume_score`, then category-coverage need. The
scores are **deliberately coarse editorial judgments**, not measured keyword volumes — S1 flagged
picking a keyword tool later; when real volume data exists, `search_volume_score` should be
re-derived from it and the composite recomputed. Treat the current ranking as a defensible first cut.

### Deadline-proximity caveat

`deadline_proximity_score` and `deadline_window` are **cycle hints**, not live dates — they capture
the *typical* month(s) a competition's registration/entry closes in a normal year. Actual per-Edition
dates are established during S3 extraction / S4 verification. Rolling / year-round programs score
high on proximity because a student can always act.

## Column definitions (`master-index.csv`)

| Column | Definition / allowed values |
|---|---|
| `rank_composite` | Weighted composite score (see formula). Higher seeds sooner. |
| `name` | Official competition name. |
| `organizer` | Sponsoring organization. `unknown` if unclear. |
| `category_slug` | One of the 11 seed slugs (see below). `other` = genuinely cross-cutting only. |
| `official_url` | Official homepage. |
| `grade_band` | Human-readable eligible grade band (e.g. `9-12`, `6-8`, `K-12`, `3-12`). |
| `region_scope` | `national` / `state` / `regional` / `local` / `virtual`. |
| `cost` | `free` / `paid` / `unknown` (entry cost to the student/team). |
| `participation` | `individual` / `team` / `both`. |
| `entry_pathway` | `individual` (student can enter alone) / `school_or_chapter` (only via school/chapter) / `either`. |
| `likely_recurrence` | `annual` / `one_off` / `rolling`. |
| `search_volume_score` | 1–5, name-recognition / expected organic search demand. |
| `coverage_score` | 1–5, category-coverage value. |
| `deadline_proximity_score` | 1–5, deadline imminence / rolling availability. |
| `notes` | Short factual note (≤ ~12 words). Facts only. |

These map onto the R1-1 Competition/Edition Spine columns (`docs/domain-model.md` §3a): `category_id`,
`official_url`, `min_grade`/`max_grade`, Edition `scope_level`, `cost_type`, `participation_mode`,
`entry_pathway`, `recurrence`. `region_scope` here is the Competition-level *derived* facet; the true
model attaches regions at the Edition level (`EditionRegion`).

### The 11 seed category slugs (exact — from `docs/glossary.md` + the R1-2 seed)

`math` · `science-engineering` · `computer-science` · `robotics` · `debate-speech` ·
`business-entrepreneurship` · `writing-essay` · `arts-music` · `academic-bowl` ·
`history-geography-civics` · `other`

## Provenance & copyright

- **Facts are not copyrightable.** Competition names, organizers, dates, fees, eligibility, grade
  bands, and URLs are factual and safe to record.
- **Prose is copyrightable.** This artifact contains **no marketing copy** lifted from source sites.
  The `notes` column is our own terse factual shorthand. Per S4, all published descriptions are
  **written fresh** — never pasted from an organizer's site.
- Entries were compiled from **public aggregator lists, national-organization calendars, CTSO
  calendars, and gifted-program directories**, then de-duplicated. Every row is a real,
  US-operating, currently-active K-12 competition to the best of research knowledge at compile time;
  S3/S4 re-verify each before anything is published. Confirmed-defunct programs were excluded.
- **Post-S2 audit cleanup (2026-07-12):** a data-quality audit removed 42 rows from the original
  326 — cross-category duplicates, confirmed-defunct programs (e.g. Nat Geo GeoBee/GeoChallenge,
  Google coding competitions, the Treasury Financial Capability Challenge), and vague umbrella rows
  whose `official_url` pointed at a different program — and repaired a few in place with
  web-verified real programs (NASA Student Launch, USESO, INCubatoredu National Pitch). Rule going
  forward: **a row's `official_url` must belong to that specific competition.**
- **S2b extension (2026-07-29):** +58 rows (284 → 342), each verified against its official site for
  an active 2025-26/2026-27 cycle before inclusion. Notable coverage gains: seven world-language
  exams + classics exams (`academic-bowl` 18 → 30), MUN circuit majors (`debate-speech`), and
  CTSO/umbrella events (FFA CDEs, TSA National Conference, Beta Club). Candidates confirmed
  defunct/dormant during this pass and deliberately excluded: JSA (dissolved 2024), ProjectCSGIRLS,
  Caribou Contests, Lexus Eco Challenge, Panasonic Academic Challenge, Letters About Literature.
  One in-place repair: Conrad Challenge's `official_url` → `conrad.spacecenter.org` (old domain's
  TLS is dead).
- **S2c extension (2026-07-29):** +106 rows (342 → 448), same per-site verification bar, going one
  tier deeper: **state/regional science fairs + junior academies** (20, incl. TXSEF, SSEF Florida,
  PJAS, GSEF), **university math tournaments + state math circuits** (16, incl. EMCC, TMSCA, FAMAT),
  the **MUN/model-congress/national-circuit debate invitationals** (18, incl. PMUNC, Greenhill,
  Stanford Invitational), **scholastic journalism/theatre/film** (16, incl. NSPA/CSPA/JEA/Thespys —
  a previously uncovered lane), more essay/civics (13), misc national STEM (12, incl. Breakthrough
  Junior Challenge, MITRE eCTF HS), and state academic/reading leagues (11, incl. UIL Academics,
  America's Battle of the Books). Confirmed-dead this pass: Mandelbrot, Online Math Open, Illinois
  WYSE/ACES, HSCTF, CyberStart America, NASA App Development Challenge (paused), White House Student
  Film Festival, Lexus Eco Challenge, and the Carnegie-rental vanity music circuit (excluded by
  policy). Note: some fall-cycle rows (CSPA Aug 31, Greenhill/VAMUN/BosMUN Aug-Sep, JEA Oct) have
  imminent deadlines — curators should prioritize them in S4.

## Descriptions, prep resources + FAQs now come out of S3 (2026-08-28)

The extractor used to emit `"description": null` on purpose — curator prose was S4 work — which in
practice meant every seeded listing reached the queue blank. It now writes **original prose from the
facts** (never a paraphrase of the organizer's copy; that rule is unchanged) and suggests about
**eight prep resources** (~5 non-Amazon spread across types, plus 2-3 Amazon books) and **3-5 FAQ
entries** — taken from the page's own FAQ where there is one, written from the extracted facts
where there is not.

**What this changes for a curator at S4:**

- **Read the description.** It is model-written prose about a minors-facing listing, and its first
  ~300 characters become the card blurb. It is the thing on the review screen most worth a second
  read.
- **Check the links.** The prompt forbids inventing URLs and says five real links beat eight with
  two invented ones — but verify before approving. A dead or wrong link ships to students.
- **Resource preview images are never in the payload.** Both prompts forbid `imageUrl` and the
  extractor strips it, because an Amazon image id can't be derived from an ASIN and an `og:image`
  can't be known without fetching — so any value would be a guess, and a guessed URL fails
  *invisibly* behind the card's onError fallback. YouTube links get a real thumbnail derived from
  their video id; Amazon book covers wait on PA-API (sweep plan §17); everything else uses the
  per-type art, which is what that art is for.
- **Amazon links arrive UNTAGGED and unflagged, deliberately.** `isAffiliate: true` from an
  extraction is a validation error. Swap in the `tag=beecompete-20` URL and tick the affiliate box
  **at the same moment** — the tag is what creates the disclosure obligation (compliance DQ10).
- **Read the FAQ answers hardest of all.** They publish under our name with **FAQPage structured
  data** on them, so a wrong answer is both a misled student and a schema-marked false claim. The
  prompt forbids inventing a policy and tells the model to omit any question it cannot answer from
  stated facts — but an answer that merely sounds plausible is exactly what this needs a human for.
  If a row states a rule you cannot find on the official page, delete it.
- Import review now shows the whole **Resources & FAQ** step, both halves — approve persists both
  since 2026-08-28.

The hand-paste path (`paste-json-prompt.md`) does the same two things, plus an **image prompt** —
art direction in words for the listing's cover, which the curator takes to an image generator and
uploads themselves. Removed 2026-08-31, restored 2026-09-01; either way **neither prompt ever
sources imagery** — no `logo`, no image URL, no cover-art link (see the bullet above).

## Eligibility basis — rows needing a curator pass

Migration `0023` added `competition.eligibility_basis` (glossary "Eligibility basis") and backfilled
it from which ranges each row happens to hold. That inference is right for a row carrying one range
and **wrong for a particular shape**: a row holding both, where the age range is the organizer's and
the grade range is one the extractor derived from it. Those rows backfill to `BOTH` and are really
`AGE`. SQL cannot tell them apart — only the official page says which axis is real — so this is a
curator pass, not a changeset.

Every row in the import queue that carries an age range at migration time is listed below. Each one
also carries grades, because the pre-`0023` extraction prompt converted age statements into grades.
**Open the official page, decide which axis it actually states, and set the basis on the listing's
Eligibility step.** Where the page gives only ages, also clear the grade range: a derived range is
regenerated for filtering later (see `eligibility-basis-plan.md` §4, PR 3) and should not sit in the
stated columns pretending to be curated.

| Listing | stored grades | stored ages | likely basis |
|---|---|---|---|
| Breakthrough Junior Challenge | 7–12 | 13–18 | **AGE** — the rules state ages only |
| Diamond Challenge | 9–12 | 14–18 | **AGE** |
| FIRST LEGO League Challenge | 4–8 | 8–16 | **AGE** (varies by region — check the page) |
| FIRST Robotics Competition | 9–12 | 14–18 | **AGE** |
| FIRST Tech Challenge | 7–12 | 12–18 | **AGE** |
| National Arts Competition | 10–12 | 15–18 | check — may be BOTH |
| Scholastic Art & Writing Awards | 7–12 | 13+ | **BOTH** — the page states grades 7–12 *and* age 13+ |

"Likely basis" is a reading of the source pages at the time of writing, not a verified curation
decision — confirm each against the live page before setting it. Until a row is reviewed it shows
both ranges, which is already better than publishing the derived grades alone, but it is not right.

⚠ **The extractor no longer creates this problem** (`tools/seeding/src/prompt.ts`): it records the
axis the page uses and is explicitly forbidden from converting between the two. Rows extracted from
here on carry a real `eligibilityBasis`; only the pre-2026-08-28 backlog above needs hand review.
