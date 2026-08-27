# Sweep remediation — remaining backlog (rev 2026-07-18)

**History.** The 2026-07-13 admin/marketplace audit + the 2026-07-15/16 sweep build (readiness gate,
combined complete-by-default create, create-form stepper, and Now-bucket items **15–22**) are **fully
built and shipped** (in prod as of R1.2). Durable decisions were migrated to their home docs —
`architecture.md` §13a/§2, `setup-runbook.md` §6, `domain-model.md` §3f/§8/§8a, `page-blueprints.md`
#32–37 — so this doc now carries only the **not-yet-built** work below.

Ground rules: additive-only migrations; server is the source of truth (client validation mirrors,
never replaces); all shared UI from `packages/ui`; Conventional Commits; migration numbers assigned at
build time (next free number), not reserved here.

**Open carry-over (one):**

- **Org-trust positive detail render** (org verified seal + host-maintained line, `trust-panel.tsx`) —
  the branch is now live in prod, but the render still needs a real competition with an organizer to
  eyeball. Do this once the **first seeded listing** lands on the catalog (ties to the R1-17 content
  gate; prod has no seeded listings yet). Low-value visual spot-check, not build work.

_(Settled: **whole-row-click on admin tables** stays deferred — decision + rationale in
`architecture.md` §13a; **cover-upload AWS key rotation** done by the owner.)_

---

## Phase 2 — R2 schema/payload batch (don't build now)

### 8. Import → created-competition link — schema (additive)

Approving an import creates a competition but records no link. **Plan:** additive column
`import_record.created_competition_id uuid NULL`; stamp it in the import-approve service; expose in
the admin import-record response; render a "created listing" link on reviewed import detail/rows.
(Owner explicitly deferred 2026-07-13.)

### 9. Card-level "Date TBD" label — search projection

Detail pages show "Deadline · TBD" (shipped); cards show nothing for TBD-only competitions. **Plan:**
the search projection adds a `deadline_tbd` boolean (`EXISTS (… kd.type IN (REG_CLOSE,
SUBMISSION_DUE) AND kd.starts_at IS NULL)` when `next_deadline IS NULL`) → carry through
`CompetitionSearchService.Item` → `CompetitionSummary.deadlineTbd` → `toCardData` maps a quiet
`deadlineLabel: 'Date TBD'`. Pairs with R2-10 (popularity sort touches the same native SQL +
payload). Interacts with the "Bragging rights" prize fallback only in the footer layout (both render).

### 10. Listing-health v2 checks — admin payload

The v1 checklist omits two checks because the admin edition-list payload carries no
key-date/region aggregates (no-new-fetches rule). **Plan:** add a small summary to the edition list
response (`hasDeadline: REG_CLOSE|SUBMISSION_DUE dated-or-TBD exists`, `regionCount`) via one
grouped query each; add the two checks in `lib/listing-health.ts`; then the deferred list-page
health column becomes possible (same aggregates).

### 11. Retire the vestigial verification write paths — rides R2-7 (RBAC)

Competition/edition `setVerification` endpoints exist but nothing calls them; the columns are held
at `CURATED` (domain-model §3f). **Plan:** when R2-7 lands real RBAC (and the claim flow formalizes
org-ladder writes, DQ11): remove the dead endpoints + request-DTO field; add a code-level assert
that competition/edition `verification_state` stays `CURATED` on every write path. Columns stay
(additive-only).

### 12. Region payload: expose level + code on the public search projection (owner 2026-08-17)

**Problem.** `CompetitionSummary.regions` is a flat `string[]` of names. The DB has everything the
card wants — `Region` is a structured tree (`COUNTRY|STATE|COUNTY|CITY|VIRTUAL`, `code`, `parent`)
with 50 states + DC + ~1000 cities + the virtual region seeded (Liquibase `0010`, cities widened
by `0018`) — but none of it
survives into the search payload. So the web now carries a hand-written **name→USPS-code map +
name heuristics** (`apps/web/src/lib/us-states.ts`, `regionLabel` in `catalog-display.ts`) to
render "Austin, TX" / "Texas" / "Online": a *city* is guessed as "any name that isn't a known
state / the US tag / the virtual region". That map is knowingly duplicated data and the heuristic
breaks the day a non-US or ambiguous region appears.

**Decision: display logic NOW (shipped, #76/#77), payload fix at R2 — not now.** The client-side
form is fully working and tested (11 `regionLabel` tests); the payload change touches the search
projection + its cache shape, which is exactly the "R2 schema/payload batch" this section exists
for. Nothing user-visible is blocked in the interim, so there is no reason to break payload
compatibility mid-R1.

**Plan (additive):**

- `RegionRef { name, code?, level }` on `CompetitionSummary.regions` (replacing the bare string —
  the search projection already joins region rows, so no schema change and no migration; this is
  DTO + projection only). Keep the field name `regions`; ship the shape change in one R2 batch
  with the other payload items so caches/ISR invalidate once.
- Same ride-alongs, same pass: `prizeKind`/`prizeValue`/`prizeCurrency` on the summary (Phase 3
  §15 slice 2 names this same DTO gap — coordinate so the projection is touched once).
- Web: `regionLabel` switches from name-heuristics to real levels — city = `level === 'city'`,
  state code from `code`, virtual = `level === 'virtual'` — and **`us-states.ts` is deleted**
  except for `US_STATES`, which the digest form still needs for its picker options.
- Composition rule stays exactly as pinned by the #77 tests: full state name alone, "City, ST"
  when paired, "Nationwide" for country-only, "Online" for virtual, undefined when untagged.
  The tests are the contract; only the classification source changes.

### 12a. Detail page shows only ONE edition — past/future runnings are invisible (found 2026-08-25)

**Problem.** Every panel on `/c/[slug]` resolves a single edition through `currentEdition(...)`
(`at-a-glance`, `key-facts`, `awards-panel`, the timeline, the page's own JSON-LD). The public
payload carries the FULL `editions` array, so for a competition with more than one running the page
silently renders one and drops the rest — no year switcher, no "past runnings", no way to see last
year's dates, fee or results. Found while auditing the all-fields fixture
(`scripts/seed-mock-competition.mjs`) against the payload: 45 fields checked, this was the largest
gap.

**Decision: not now.** Two reasons. (1) It is a **blueprint change, not a bug fix** — what a listing
should show when it has history (a year selector? a collapsed "previous runnings" list? results
links?) is a design question, and `page-blueprints.md` Page 3 has to change before any code does
(the hero-page rule in CLAUDE.md). (2) **Impact is near-zero today**: the catalog is one season old,
so effectively every listing has exactly one edition. The gap widens only as seasons accumulate,
which is an R2 timeframe anyway.

**Watch for the collision with §13.** Phase 3 renames per-place runnings to **Stages** under a
single annual Edition. A multi-edition UI designed now against the R1 interim shape (separate
Edition records per place) would be designed against a model that is already scheduled to change —
so whatever ships here must be about **seasons over time** (2025-26 vs 2026-27), never about places
within one season, which is §13's job.

**Plan sketch (R2, blueprint first):**

- `page-blueprints.md` Page 3: where prior runnings live, and what a prior running shows (probably
  cycle label + its deadline + results link, not a full second at-a-glance strip).
- Web only, no schema and no payload change — `editions` is already fully populated; this is
  presentation. `currentEdition()` stays the source for the primary panels.
- Decide the archive rule: does an archived edition appear? (Public payload already excludes them.)
- SEO: confirm one canonical URL per competition — prior runnings are sections, not routes, unless
  the blueprint deliberately says otherwise.

---

## Phase 3 — Host Tools, lifecycle machine & structure (don't build now)

_Items 13/14 are **design-gated at Gate A** — deliberately not planned deeper here (don't harden
early; the recorded target models are the plan). Item 15 is **not** gated: it is registry **H47**,
whose target shape is already recorded, so it is planned to the level below._

### 15. Typed prize / award structures — H47 (owner-requested 2026-08-17)

**Ask.** The card's prize slot should stop showing free prose ("Medals, trophies and scholarship
awards") and show a *specific* kind — **bragging rights · knowledge · money (with the amount) ·
scholarship · internship**, plus other appropriate kinds.

**Why it is not an R1 display tweak.** Today `Edition.prize_summary` is a free-text `varchar(500)`
written by curators; `prize_value` + `prize_currency` exist beside it but are **not exposed on
`CompetitionSummary`**, so the card literally has no structured prize to render. Delivering the ask
means a new typed field, a migration, API + DTO changes and admin UI — 🔒 full-loop work by
`development-process.md`, and it lands squarely on registry **H47** ("per-Edition award list …
place, monetary/non-monetary/travel-grant, value + currency, display order"), whose `Award` entity
is **reserved** in domain-model Rev 7. Building a prize enum now would harden a reserved entity
ahead of its phase — the thing CLAUDE.md's hard-stop rule exists to prevent.

**Target model** — extend H47 rather than invent a parallel one. `Award` (reserved) already carries
place / kind / value + currency / display order; the card needs only a **cheap derived summary** of
an Edition's award list, not the list itself.

- **`prize_kind`** enum on Edition (additive, nullable): `BRAGGING_RIGHTS | KNOWLEDGE | MEDAL_TROPHY
  | CASH | SCHOLARSHIP | INTERNSHIP | TRAVEL_GRANT | GEAR | PUBLICATION | OTHER`. Rationale for the
  ones beyond the owner's list: `MEDAL_TROPHY` because it is what most current summaries actually
  say; `TRAVEL_GRANT` because H47 already names it; `GEAR`/`PUBLICATION` are common real prizes that
  would otherwise all collapse into `OTHER`. ⚠ Add the enum to the **glossary first** (CLAUDE.md
  rule) — these become user-visible labels and filter values.
- **Amount** reuses the existing `prize_value` + `prize_currency`; no new money columns. The
  existing invariant (`prize_value ≥ 0`, ≤2 dp, currency required when value present) already
  covers it. Card renders `$5,000` for `CASH`/`SCHOLARSHIP` when a value exists, else the kind label.
- **Multi-kind** competitions (cash *and* internship) are exactly what H47's award LIST solves.
  Interim single `prize_kind` = the dominant/headline prize; do not model an array on Edition, or it
  will have to be unpicked when `Award` ships.

**Slices, in order** — each independently shippable, additive-only:

1. **Schema + glossary.** Glossary entry for the kinds; Liquibase (next free number) adding
   `edition.prize_kind` nullable + a check constraint. Backfill stays `NULL` — see the honesty note.
2. **API.** `prize_kind` on the Edition admin request/response and `CorrectionFields`; add
   `prizeKind` + `prizeValue` + `prizeCurrency` to `CompetitionSummary` (the search projection) so
   the card can read them. This is the same DTO gap that forces the region name→code map in
   `lib/us-states.ts` — **fix both in one pass** and delete that map.
3. **Admin.** Kind picker on the Edition form beside the existing value/currency fields; the pair
   already validates together.
4. **Web.** Card renders kind (+ amount); `prize_summary` becomes the tooltip/detail-page long form,
   not the card line. Extend `catalog-display` with a `prizeDisplay()` alongside `regionLabel`.
5. **Filter (optional, R2+).** "Has cash prize" / "Scholarship" facet — only worth it once kinds are
   populated; needs a search-index change, so keep it out of the first pass.

⚠ **Honesty constraint — the reason this cannot be a pure data migration.** `prize_kind` cannot be
inferred from `prize_summary` by keyword matching; "no cash prize, just bragging rights" would
classify as `CASH`. Rows must be curated, so the field stays **nullable** and the card must fall
back to today's behaviour when it is `NULL` (the existing "Bragging rights" fallback for a null
summary is a *display* default and must not be written into the column as if it were curated fact).
Plan for a long tail of `NULL` and a curation pass, not a one-shot backfill.

**Not in scope here:** winner assignment (Gate B, judging), award display order, per-place award
lists on the detail page — all H47 proper.

### 16. Promote eligibility JSONB keys → Spine columns (owner 2026-08-18)

`eligible_countries[]`, `citizenship_countries[]`, `student_status_required` are today **standard
attributes-bag keys** (JSONB, display-only — domain-model 2026-07-08), rendered under the detail
page's Eligibility group (#82). **Owner decision: promote them to real Spine columns later so they
become filterable/indexable; leave as JSONB for now.**

**When:** with **H36 eligibility pre-screening (Phase 3)** — the first feature that *reads* these
fields programmatically. H36 also picks up the **school-enrollment restriction** ("must be
enrolled at one of: [school orgs]") decided 2026-08-23 — design + the visibility lever live in
domain-model §8b (owner-decisions block); it is an eligibility mechanism for inter- AND
intraschool competitions, not a visibility setting. Promoting earlier buys an index nobody queries; promoting later than H36
would force H36 to parse JSONB. If an "eligible from my country" *filter* is demanded sooner
(international expansion), pull it into the then-current R-batch instead.

**Plan (additive, the designed JSONB→Spine promotion path):**

1. Migration (next free number): `competition.eligible_countries text[]`,
   `citizenship_countries text[]`, `student_status_required varchar` — nullable, plus GIN indexes
   on the arrays. *(Country codes ISO-3166-1 alpha-2 — glossary entry at build time.)*
2. Backfill from `attributes` where the keys exist; **leave the JSONB keys in place** during a
   deprecation window so nothing breaks mid-deploy; strip them from Category Templates + bag in a
   follow-up change once admin writes target the columns.
3. Admin: typed inputs on the competition form replacing free-JSON entry — **done early
   (2026-08-23):** the Eligibility tab writes all three keys (CSV country lists + status text)
   into the attributes bag; at promotion time only the write target changes. Correction-queue
   fields still ride along at promotion.
4. API: columns onto `CompetitionSummary`/`CompetitionDetail`; add `eligibleCountry` search param
   when the filter ships. Web: `ELIGIBILITY_ATTR_LABELS` in `key-facts.tsx` switches from bag keys
   to DTO fields — display labels and grouping survive unchanged.

### 13. Competition structure — Edition → Stage → Round (H24/H25)

An R1 `Edition` carries a single date/fee set and `delivery` is competition-level, so a tiered
competition can't vary deadlines/costs/delivery per level. **Target model** (domain-model **§8b** +
glossary): annual cycle = **Edition** (one per year); each per-place level-instance = **Stage**
(owns dates/cost/registration/region, linked by `advances_to`); **Round** = sequential phase within
a Stage. Built by registry **H24/H25** at Phase 3, designed at Gate A. **R1 interim:** one running =
one `Edition` + per-level milestones as `KeyDate`s (typed key dates make this practical); tier
structure in prose/FAQ; defaults with a "select your region for specifics" disclaimer. **Do not**
hand-model tiers as separate Editions at R1.

### 14. Listing-status state machine + host publish controls — ✅ BUILT 2026-08-25 (migration `0021`)

**Built 2026-08-25** (owner pulled it forward for multi-curator review; as-built in
domain-model §8a). Landed: `listing_status` (incl. `IN_REVIEW`, live now as curator
submit-for-review), Publish/Unlist/Re-list/Send-back actions + badges + Save-as-draft, the
`approved_at`/`approved_by` stamp, the three-leg public gate, and the unified `/admin/review`
queue (IN_REVIEW listings + pending imports). Still Phase 3: DQ12 host review semantics
(edit-keeps-live-version), `visibility` (H48), `list_at`. Original sketch kept below.

Deferred 2026-07-14 (real driver — self-serve hosts — is Phase 3; R1 is covered by archive/restore +
the readiness gate). **Plan sketch (full design: domain-model §8a):** additive migration (next free
number) adding `listing_status` (`DRAFT|PUBLISHED|UNLISTED`, plus `IN_REVIEW`) with
`PUBLISHED` backfill; Publish / Unlist / Re-list admin actions + status badges + "Save as draft";
the §8a seams — **IN_REVIEW / DQ12** pre-publication review (an edit keeps the live version public
while re-reviewed), **`visibility`** (public / link-only / invite-only, H48), **`list_at`**
scheduled listing. **Also lands here: the approval stamp** — `approved_at`/`approved_by` (additive
pair; owner deferred 2026-07-15), auto-stamped on admin create + import approve (`approved_by` null
until RBAC R2-7); the DQ12 review outcome writes it in Phase 3. Additive throughout — re-composes
cleanly onto the readiness gate.
