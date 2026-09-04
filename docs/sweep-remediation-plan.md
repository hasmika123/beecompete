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

## Blocked on an external gate — check back, don't plan around it

### 17. Amazon product images via PA-API — **BLOCKED until the Associates account qualifies** (owner 2026-08-28)

**The trigger to check:** Associates Central → **Tools → Product Advertising API**. If the account
qualifies, that page issues an access key + secret; if it doesn't, it says so instead. The gate is
**qualifying sales** — Amazon's documented threshold has been **3 within 180 days** of enrolling,
and access can lapse again if sales stop. The owner is treating **10 sales** as the moment to go
look, which is a comfortable margin over the documented number. Amazon has changed these terms
before: **read the page, don't trust this paragraph.** Enrolled 2026-08-25, tag `beecompete-20`.

**Why it is worth doing then.** Book cards on the Prep resources row currently render the generic
per-type SVG. PA-API is the **licensed** way to show real cover art — the Associates Operating
Agreement permits product images obtained through it, and permits no other route (scraping or
hotlinking `m.media-amazon.com` is not a grey area, it is a breach that costs the account). It also
solves freshness: price, availability and cover all come from the same call.

**What to build when it unblocks:**
- Server-side PA-API client (credentials via env, never committed) — `GetItems` by ASIN.
- Populate `resource.image_url` for `BOOK` rows whose URL is an Amazon product link.
- Honor the API's caching rules: the Operating Agreement caps how long responses may be stored and
  requires content to be refreshed or dropped. **This is the part that makes it a scheduled job,
  not a one-off backfill** — budget for a refresh task, and see the Neon cost note in
  `setup-runbook.md` before pointing any recurring job at the database.
- Leave the fallback chain intact underneath: a missing or expired image must still land on the
  per-type SVG.

**What NOT to do in the meantime:** do not scrape product images, do not let a model emit an
`imageUrl` (both prompts forbid it and `tools/seeding` strips it — a guessed URL fails invisibly
behind `ResourceArt`'s onError), and do not hotlink covers from publisher sites either — same
copyright, without even an affiliate agreement to sit under. Non-Amazon merchants have the same
shape of answer: **the affiliate network's product feed is the image licence**, per merchant.

**Already done and not blocked:** YouTube thumbnails, which are derived from the video id in the
resource's own URL (`youtubeThumbnail`, `detail-display.ts`) — no API, no key, nothing to guess.

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
- *2026-09-01: this now **rides §19** (season-owns-the-listing) — past seasons become accurate
  full snapshots there, which is exactly what this display needs. Blueprint gate still applies.*

### 18. Organizer contact NAME + ROLE on the curation form (owner 2026-08-31)

Requested as a follow-on to the create form's contact group. Today `0019` gives every Category
Template `contact_email` and `contact_phone`; this adds the person those reach — a name and the role
they hold ("Dr. Jane Smith", "Tournament Director").

**Why it waits.** Two display-only optional attribute keys do not justify a migration of their own.
`0019` is the shape to copy, and the next Category-Template batch in this phase is the right ride.
(Not §16 — that is a Phase-3 promotion, and these two never become Spine columns: nothing filters or
sorts on them.) Nothing depends on this, and no listing is wrong without it.

**Plan (additive, no Spine columns):**

- Migration in the `0019` mould: `jsonb_set` two optional keys — `contact_name`, `contact_role` —
  onto every Category Template. Idempotent, additive, display-only. Per domain-model §7 they stay in
  the bag: nothing filters or sorts on them.
- Form: two Inputs in the existing Administration contact group, optional like email/phone. Mirror
  server limits the way the 2026-08-30 rules pass does — so give them `@Size` if they ever become
  Spine, and a `LIMITS` entry either way (name ~120, role ~120 is ample).
- Public: `contact-card.tsx` already renders the group and treats the bag as untrusted; add the two
  fields to that same gate. `detail-display.ts` needs the two humanized labels.

**⚠ The compliance line, and why this one is not merely cosmetic.** `0019` states the rule these
fields have to live inside:

> These are the ORGANIZER'S published contact points, copied from their site — never a participant's
> or curator's personal details.

An email like `info@org.org` is a role address. **A person's NAME is not** — it is personal data
about a named individual, and publishing it is a different act from publishing an organization's
inbox. The field is only acceptable when the organizer has *already published that person by name in
that role* on their own site; it is never a place to record a private staff contact a curator found
elsewhere. The form hint must say exactly that, in the `0019` style, and the seeding prompts must be
told to extract it only from a public staff/contact listing — otherwise a bulk run will quietly turn
"whoever signed the PDF" into published PII. Worth a look from the same review that covers the legal
pages before it ships.

### 19. Season-owns-the-listing rebuild — SE-1…SE-7 (owner decision 2026-09-01)

**The decision is recorded in `domain-model.md` §8c** — the Competition keeps permanent identity
only; everything yearly (prose, eligibility, format, judging display info, fees, FAQ, resources,
attributes) lives on the **Season** (`edition`), and "Open next season" copies content forward.
This section is the build scoping. **R2 work**, the largest item in this phase — schema touch means
the **full loop** (plan → 🧑 approve per slice). Order: SE-1 → (SE-2 ∥ SE-3) → (SE-4 ∥ SE-5 ∥
SE-6) → SE-7. Additive-only throughout; because SE-1's backfill copies competition values onto the
existing editions (identical by construction), every read-path cutover returns the same data —
each slice deploys as a visible no-op until the workspace UI (SE-4) ships.

- **SE-1 · Schema + backfill (M).** One Liquibase batch (next free number): `edition` gains
  `summary, description, delivery, participation_mode, team_size_min, team_size_max,
  entry_pathways, eligibility_basis, min_grade, max_grade, min_age, max_age, evaluation_type,
  cost_type` (all nullable; `age_cutoff_date` already there — eligibility reunified); the JSONB
  keys (`judging_criteria`, `tie_breakers`, `rules_url`, eligibility + contact keys) start being
  written to `edition.attributes`; `competition_faq` + `resource` gain nullable `edition_id`
  (backfilled to the current edition, `competition_id` retained for the identity join);
  `competition` gains `current_edition_id` (nullable FK). Backfill copies each competition's
  values onto its non-archived editions. Old competition columns STAY (additive-only):
  `summary`/`description` become **write-through mirrors of the current season** — the generated
  `search_vector` (`0007`) reads them, so never drop them without rebuilding FTS; the rest are
  vestigial, commented as such (same pattern as `verification_state`).
- **SE-2 · API read paths (M).** Server-side current-season resolution maintained on
  edition/key-date/status writes (same precedence as web `currentEdition()`: open → ongoing →
  upcoming → latest-dated); public detail serves season-scoped values **pre-merged** (web never
  learns about mirrors); search predicates (grade / cost / delivery / participation / pathway /
  evaluation) re-point at the current edition via a join, facet counts likewise; fixes the
  card-deadline vs displayed-season mismatch by scoping `nextDeadline` to the current season
  (cross-season fallback only when it has no future date).
- **SE-3 · Curation API (M).** `EditionRequest` grows the moved fields (+ mirrored `LIMITS`);
  `CompetitionRequest` shrinks to identity (transition: old fields accepted and redirected to the
  current season, then removed); curation writes to the current season refresh the competition
  mirrors; FAQ/resource endpoints become edition-scoped; new **"Open next season"** clone endpoint
  (full content + regions copied, key dates → TBD, status `upcoming`); `CorrectionFields` + the
  listing-health checks re-mapped.
- **SE-4 · Admin workspace UI (L).** The unified page: identity block + **season tabs**; create,
  edit, AND import review all render it; retire `hideOnEdit` + the `edition_` FormData prefix
  convention (`competition-payload.ts` contract); rename Editions → **Seasons** everywhere;
  guardrails — editing an open season warns, the readiness gate ("no season = invisible")
  surfaces as a banner instead of a silent search exclusion. Admin pages are not hero pages — no
  blueprint gate — but this replaces the create-form stepper, so screenshot the flows for the
  owner before merge.
- **SE-5 · Import pipeline (S–M).** `import-seed.ts` split + `buildImportApprovalPayload` re-map
  to the season; the empty-cycle-label published-but-invisible trap is retired by construction (a
  season always exists in the workspace); `tools/seeding` extraction schema + prompts re-tiered.
  Read `docs/seeding/README.md` before touching any bulk-run behavior.
- **SE-6 · Public web (S).** Consume the pre-merged season payload (mostly transparent); verify
  JSON-LD / OG / structured-data field sources still resolve; §12a's past-seasons display becomes
  *possible* here but stays blueprint-gated (Page 3 first).
- **SE-7 · Docs sync (S).** After build: `architecture.md` §13a as-built, domain-model §3
  entity shapes, Category Template validation target (= the season's `attributes`), retire the
  stale form comments; glossary check that no UI surface says "Edition".

**Watch:** §13 (Edition → Stage → Round, Phase 3) is unaffected — season content stays at Edition;
Stage still takes dates/fees/per-level judging when it arrives, and the workspace grows the
structure-first step then. §16's JSONB→Spine promotion now promotes onto `edition`, not
`competition`. §18's contact keys ride whichever Category-Template batch comes first and land in
the season's bag either way.

---

### 20. Duplicate content merge — DQ4 Phase 2 (registered 2026-09-03)

**Built now** (`duplicate-detection-plan.md`): detection + gates, the queue flags, the seeding
pre-check, and (PR 2) `duplicate_of_competition_id` with mark-as-duplicate + a permanent redirect
from the retired slug. **Not built:** moving a duplicate's *content* onto its canonical listing —
editions/seasons, resources, FAQs, follows, featured slots, correction proposals — with a
per-field pick where both rows hold a value. That is the "merging" half of DQ4 and needs the §19
season-owns-the-listing rebuild first (a merge across two season-owned listings is a season
merge). Until then a found duplicate is archived + linked; anything worth keeping is copied by
hand before marking it.

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
