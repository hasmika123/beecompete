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

## How S3 / S4 consume it

1. **S3 (extraction)** walks `master-index.csv` **top-down by `rank_composite`**. For each row it
   fetches the `official_url`, and an LLM extracts the Spine fields into JSON **validated against the
   Category Template JSON Schema** (R1-2 `CategoryAttributeValidator`). The record lands in the R1-3
   import-review queue with `provenance.source = import` and a confidence score.
2. **S4 (curation)** reviews/approves every imported record before publish. The `rank_composite`
   ordering means curators spend their first, freshest passes on the highest-demand competitions —
   the **top ~50 by expected search volume** that carry the R1 SEO thesis.
3. The columns here are **hints, not truth**. S3 re-extracts from the official page and S4 verifies;
   anything marked `unknown` here is simply left for the pipeline to fill. **Never treat a value in
   this file as verified** — it is a starting point for the demand ranking, not curated data.

## The R1 content gate this feeds (from `phase-1-plan.md`)

- **≥ 200 competitions live at launch**, spanning **all 11 seed categories** (**≥ 15 each** for the
  major ones).
- Every live listing has a **current or upcoming Edition with verified dates**.
- The **top ~50 by expected search volume** get a full spine + curated resources.

This long-list deliberately **over-supplies** that gate (300+ rows) so that attrition during
extraction and verification (dead pages, defunct programs, thin editions) still leaves ≥ 200 live.

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
