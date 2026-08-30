# Timeline model — typed events with arity

**Status:** Plan (awaiting 🧑 approval) · **Created:** 2026-08-30 · **Type:** Plan
**Executes as:** migration `0025` + `domain-model.md` §7a.2
**Supersedes nothing.** Refines decision **D3 — "Timeline as data, not columns"**, which stands.

---

## 1. The question

> We model registration as two separate milestones (`REG_OPEN`, `REG_CLOSE`), yet the form gives
> each of them a start **and** an end date. Why not make registration one event with a start and an
> end — and give events *types*, where some (registration, event, submission) carry a range and
> others (results, announcement) carry a single date?

Short answer: **the proposal is right**, the current model is a single shape doing two jobs, and the
legacy prototype independently arrived at the same design — then broke it in four specific ways this
plan is written to avoid.

---

## 2. Evidence from the current build

`KeyDateType` = `REG_OPEN · REG_CLOSE · ROUND_START · SUBMISSION_DUE · RESULTS · CUSTOM`.
`KeyDate` = `label · starts_at · ends_at · timezone`. Every type gets both date fields.

Actual use of `ends_at` (local dev DB, 52 rows):

| type | rows | with `ends_at` |
|---|---|---|
| `REG_OPEN` | 7 | **0** |
| `REG_CLOSE` | 16 | **0** |
| `SUBMISSION_DUE` | 8 | **0** |
| `RESULTS` | 10 | **0** |
| `CUSTOM` | 6 | **0** |
| `ROUND_START` | 5 | **3** |

`ends_at` is live on **3 of 52 rows**, all `ROUND_START` (multi-day finals). Both seeding prompts
already say *"Most milestones are a single moment: leave `endsAt` null. Set it ONLY when the source
says the milestone runs across more than one day."*

So the current model is not "start + end on everything". It is **instant, plus a bolt-on end for the
one type that spans** — an implicit arity model with no name and no enforcement. The start/end pair
shown on every box in the curation form is vestigial for five of six types.

Two further facts the model is fighting:

- **`REG_CLOSE` (16) outnumbers `REG_OPEN` (7) more than 2:1.** Over half of registration windows have
  no published open date. Partial knowledge is the normal case, not the exception.
- **`starts_at` is nullable since `0008`, where NULL means TBD.** So "opens TBD" is already
  expressible, and does not become ambiguous under a range model — for registration, "start unknown"
  and "start TBD" are the same operational state.

Consumers today: `CompetitionSearchService` (next deadline = earliest future `min(starts_at)` for
`REG_CLOSE`, falling back to `SUBMISSION_DUE`), `EffectiveStatus`, `key-dates-timeline.tsx` (uses
`ends_at` only for multi-day display and the calendar end), `structured-data.ts`.

---

## 3. What the legacy prototype did

Reviewed 2026-08-30 at `Workbench/BeeCompete/Repositories/master-beecompete`
(`db/patches/2025-11-05_create_competition_stages.sql`, `src/types/stage.ts`,
`src/components/stages/`). **This corrects the stale source pointer in `legacy-reference.md`**, which
still cites `~/Downloads/legacy-transfer-hub-main/`.

The legacy reached the same conclusion twice over:

- `competitions` carried **named milestone pairs** — `reg_open_at`/`reg_close_at`,
  `event_start_at`/`event_end_at`, `submission_open_at`/`submission_close_at` — and a **lone**
  `results_publish_at`. Registration as a window; results as a point. Exactly the proposal.
- `competition_stages` carried typed rows (`stage_type`), and `StageForm.tsx:168` **clears `end_at`
  when the type is `MILESTONE`**, rendering one date input for milestones and a range for everything
  else. Arity, implemented.

`legacy-reference.md` §1 already catalogs the stage model's *features*. What follows is what it does
not record: **how the design failed in practice.**

### The four failures to design against

**F1 — Arity was declared in the UI, never in the schema.** `start_at` and `end_at` are both nullable
for all six DB types. Only the React form enforced the rule. The database happily accepts a
`MILESTONE` with an end date.

**F2 — And the system's own seed data violated it.** `2025-11-05_create_base_stages_function.sql`
seeds `'Registration Period'` as `stage_type = 'MILESTONE'` — the *point* type. Because the form
hides the end-date input for `MILESTONE`, **a curator could not set a registration close date through
the form at all.** The single most important date in the product, unreachable, because the type
carried no binding meaning. This is the exact field this plan is about.

**F3 — The same fact lived in two places and was read from different ones.** Registration close was
stored both as `competitions.reg_close_at` and as the registration stage's `end_at`. Nothing synced
them. On one page: `CompetitionDetails.tsx:1354` renders the registration window from the **columns**,
while `:271` derives `isRegistrationClosed` from the **stage**. Five representations coexisted in
total — `start_date`/`deadline` scalars, `important_dates TEXT`, `timeline JSONB [{date,event}]`, the
milestone columns, and the stage rows. The TS types label some "Legacy fields"; none were ever removed.

**F4 — Type vocabularies drifted.** The DB enum is
`{SUBMISSIONS, LIVE_EVENT, JUDGING, ANNOUNCEMENTS, MILESTONE, OTHER}`; the TypeScript `StageType` is
`{SUBMISSIONS, LIVE_EVENT, MILESTONE, REGISTRATION}`. `REGISTRATION` is not a DB value — hence
`stage_type: 'REGISTRATION' as any` in `mockCompetitionData.ts:26`. `ANNOUNCEMENTS`, seeded by the SQL
function, does not typecheck. The `base_stage_key` list in the DDL comment
(`created/registration/event/submission/results`) disagrees with the six keys the function actually
seeds (`published/registration/competition/submissions/results/finished`).

Two lesser problems worth avoiding:

**F5 — Two orderings that can disagree.** `display_order NOT NULL` alongside dates produced an
"out of chronological order" warning banner and a manual **Sort by Date** button
(`StageTimeline.tsx:38-88`). Pure accidental complexity. **Our `key_date` has no `display_order` and
must not gain one** — chronology is the order.

**F6 — Arity handled by convention at each read site.** `new Date(s.start_at || s.end_at!)` recurs
through sorting and status derivation, with comments like *"MILESTONE uses start_at"*. Polymorphism
re-derived ad hoc everywhere instead of once.

### What is worth taking

- **Typed arity in the form** — one date input for a point, two for a window. The core idea, and it works.
- **`CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at)`** — ordering enforced in the DB.
  We have no equivalent today.
- **`UNIQUE (competition_id, base_stage_key)`** — singleton system rows, NULL for curator-added ones
  (Postgres permits unlimited NULLs in a unique index).
- **The "Include specific times" toggle** — a date/datetime precision flag. See §4.4; it surfaced a live bug, and is now optional.
- **The row as a container** (`instructions_md`, `resources`, `visible_to_participants_at`,
  `submission_*`, `notify_*`) — the shape the participant features grow into. See §7.

---

## 4. The final model

One table, typed rows, arity declared by type. `key_date` keeps its name and its
`edition_id` FK; D3 is unchanged.

### 4.1 Vocabulary

| type | arity | replaces | meaning |
|---|---|---|---|
| `REGISTRATION` | **window** | `REG_OPEN` + `REG_CLOSE` | registration opens → closes |
| `SUBMISSION` | **window** | `SUBMISSION_DUE` | submission opens → due |
| `EVENT` | **window** | `ROUND_START` | the competition itself running; possibly multi-day |
| `JUDGING` | **window** | — | judging under way (dates only — see below) |
| `PERIOD` | **window** | — | generic window; label carries the specifics |
| `RESULTS` | **point** | `RESULTS` | results announced |
| `ANNOUNCEMENT` | **point** | — | a dated announcement |
| `CUSTOM` | **point** | `CUSTOM` (kept) | generic dated point; label carries the specifics |

Eight types, two arities, one generic of each so the vocabulary does not need to grow for every
one-off. `label` stays on every row.

**`CUSTOM` stays `CUSTOM`** (revised 2026-08-30, glossary-first). This plan originally renamed it to
`MILESTONE`. Writing the glossary entries surfaced why that is wrong: **Milestone is already a
canonical term** — "a deadline-gated, approval-driven step in a participant's structured workflow,
with visible status" (registry HC7, 🛑 Gate B). A generic dated point on a public timeline has no
approval, no status and no workflow; reusing the word would collide with a reserved concept. Keeping
`CUSTOM` costs nothing and avoids the clash, so open question 4 is closed: **no rename.**

⚠ Related, and NOT fixed here: the curation form labels the key-date type field "Milestone", and both
seeding prompts use "milestone" throughout for what the glossary calls a **Key date**. That predates
this plan and is flagged in the glossary's Milestone row; reconciling the UI copy is its own small
task.

**`EVENT`, not `ROUND`** (revised 2026-08-30 on owner input). `Round` is already a canonical glossary
term — *"a sequential phase within a Stage (written → oral)"* — and a **reserved Phase-3 entity**
(§8b, H24). Reusing the word for a key-date type would collide with it, breaking glossary-first. And
it would misdescribe the data: today's five `ROUND_START` rows are test dates and multi-day finals —
*when the competition happens* — not phases. Under §8b, a level-instance ("Texas Regional") is a
**Stage** with its own timeline, and a phase within it is a **`Round` record**. Neither is a key-date
type. `EVENT` names what is actually left over.

**`JUDGING` is a type, not a label** (revised 2026-08-30 on owner input). Originally this plan folded
judging into `PERIOD`, reasoning that a label was enough. That was wrong given the stated intent that
**windows gate features** (§7.1): a free-text label cannot drive a gate, so anything the system must
act on has to be a type. `JUDGING` here carries **dates only** — the public fact that judging runs
between two dates, which competitors want to see. **What the window gates — a judging portal, judge
assignment, rubric mechanics — stays 🛑 Gate A** (`development-process.md` §6a); reserving the token
is not designing the subsystem, and doing it now avoids a later migration. Flagged for owner sign-off
in §8.

### 4.2 Arity, enforced in three places

Fixing **F1**. The rule is stated once in Java and backstopped in the DB:

- **`TimelineTypes`** (new, mirroring `EntryPathways`/`EvaluationTypes`) — the type→arity map, the
  application's single source of truth, validated at the curation write boundary.
- **DB check** — `CHECK (type IN ('REGISTRATION','SUBMISSION','EVENT','JUDGING','PERIOD') OR ends_at IS NULL)`.
  A point type physically cannot hold an end date. Cost: adding a type becomes a one-line migration
  rather than code-only. Worth it — this constraint is what makes **F2** unrepresentable.
- **The curation form** — renders one date control for a point, two for a window.

Plus, adopted from legacy:
`CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)`.

**Not** added: a "row must have at least one date" check. `0008` established NULL = TBD, and
"registration happens, dates unannounced" is a real, meaningful row.

### 4.3 Null semantics

| | `starts_at` | `ends_at` |
|---|---|---|
| **point** | the moment; NULL = TBD | always NULL (constrained) |
| **window** | opens; NULL = open date unknown/TBD | closes; NULL = close date unknown/TBD |

This is what makes the 16 close-only rows expressible without loss:
`REGISTRATION {starts_at: null, ends_at: 2026-11-03}` = *"closes Nov 3, open date not published."*

### 4.4 The day-only encoding — and the bug it exposed (FIXED 2026-08-30)

Adopting legacy's "Include specific times" toggle surfaced a **live display bug, since fixed**
independently of this plan. Recorded here because it settles how day-only dates are encoded.

**The contract already existed.** `paste-json-prompt.md` spells it out: a page that gives a day but
no clock time is emitted as `T00:00:00Z` **paired with `timezone: null`** — the null zone is what
marks the value day-only. The prompt even names the failure mode: *"'2026-11-03T00:00:00Z' paired
with timezone 'America/New_York' does NOT read as Nov 3 — it reads as Nov 2, and a student sees a
deadline a day early."*

**The public side did not honour it.** `dates.ts` fell back to `DEFAULT_TIMEZONE` (Eastern) whenever
a key date had no zone, so every day-only extraction rendered **one calendar day early** on the
public timeline, the card deadline, the At-a-glance cell and the schema.org dates. A `REG_CLOSE` of
Jan 1 2026 rendered as **"Dec 31, 2025"** — the wrong year. `import-seed.ts` and
`import-edition-panel.tsx` had already worked around this locally with `?? 'UTC'`, each with a
comment explaining it; the public path was simply never given the same rule.

**Fix:** a `keyDateZone(timezone)` helper in `dates.ts` — `timezone ?? 'UTC'` — applied at every key
date read site. Audit timestamps (`createdAt`, `reviewedAt`, `lastVerifiedAt`) pass no zone at all
and correctly keep `DEFAULT_TIMEZONE`. Rows *with* a stored zone are genuine wall-clock deadlines
("11:59 PM ET") and are untouched — pinned by a test. The API needed nothing: it compares `Instant`s,
which is zone-independent.

**What this means for `all_day`.** The urgent case is handled, so `all_day` is **no longer required**
by `0025`. It remains worth adding for one reason: today "day-only" is encoded as *absence of a
timezone*, which makes a day-only date with a **known** zone inexpressible ("closes Nov 3, Pacific
time, no hour given"). An explicit flag separates the two facts instead of overloading one. Optional,
not blocking.

### 4.5 Two derived expressions, defined once

Fixing **F6**. These are different rules and must not be collapsed into one `COALESCE`:

- **`deadlineAt`** — `ends_at`, for `REGISTRATION` and `SUBMISSION` only. **No fallback to
  `starts_at`**: a registration row with a known open date and an unknown close date has *no known
  deadline*, and saying otherwise would advertise the opening as a deadline.
- **`sortAt`** — `COALESCE(starts_at, ends_at)`. Ordering only; undated rows sort last.

`nextDeadline` becomes the earliest future `min(ends_at)` for `REGISTRATION`, falling back to
`SUBMISSION` — semantically identical to today's `REG_CLOSE` → `SUBMISSION_DUE`.

### 4.6 What is deliberately excluded

- **No `display_order`** (**F5**). Chronology is the order.
- **No milestone columns on `competition`** (**F3**, and D3). Rows only.
- **No nested submission window.** Legacy gave a stage both `start_at`/`end_at` *and*
  `submission_open_at`/`submission_close_at` plus a `submission_window_inherit` flag. **One window
  per row.** A round whose submission window differs from the round is a second row
  (`EVENT` + `SUBMISSION`), not a nested window with an inherit toggle. This deletes an entire
  category of "which window applies?" logic before it exists.

---

## 5. Migration `0025`

Additive-only, following `0024`'s pattern. The old `key_date` rows are rewritten in place (unlike
`0024`, this is a row remap within one table, not a column swap).

| old rows | → | dates |
|---|---|---|
| `REG_OPEN` (7) + `REG_CLOSE` (16) | `REGISTRATION` | `starts_at` ← `REG_OPEN.starts_at`; `ends_at` ← `REG_CLOSE.starts_at` |
| `SUBMISSION_DUE` (8) | `SUBMISSION` | `ends_at` ← `starts_at`; `starts_at` ← NULL |
| `ROUND_START` (5) | `EVENT` | unchanged (3 keep their `ends_at`) |
| `RESULTS` (10) | `RESULTS` | unchanged (no `ends_at` exists) |
| `CUSTOM` (6) | `CUSTOM` | unchanged — no rename, no rewrite (§4.1) |

**Pairing rule.** Within an edition, pair the *i*-th `REG_OPEN` with the *i*-th `REG_CLOSE` ordered by
`starts_at`. Surplus rows on either side become half-open `REGISTRATION` rows. Any edition holding
more than one pair is **reported for a curator pass**, not silently merged — the same treatment the
`eligibility_basis = BOTH` rows got in `0023`.

**Label and timezone on a merged row.** Take `REG_CLOSE`'s, falling back to `REG_OPEN`'s. The type is
self-describing, so a generic label ("Registration closes") should be dropped rather than carried —
flag these for the curator pass.

**Order of operations.** Add columns and constraints → backfill/remap → add the arity `CHECK` last, so
the constraint validates the finished data rather than blocking the backfill.

---

## 6. Blast radius

`0024` is the closest precedent; this is somewhat larger because the public timeline is involved.

- **API** — `KeyDateType`, new `TimelineTypes`, `KeyDate`, `CompetitionWithEditionRequest`,
  `ListingCurationService`, `ImportReviewService`, `CompetitionSearchService` (the `nextDeadline` SQL),
  `EffectiveStatus`, `CatalogPublicController`, `EditionAdminController`
- **Web** — `key-date-manager.tsx` (per-type controls), `key-dates-timeline.tsx`,
  `competition-form.tsx`, `import-edition.ts`, `import-seed.ts`, `import-queue.ts`,
  `competition-payload.ts`, `catalog-types.ts`, `admin-types.ts`, `structured-data.ts`,
  `detail-display.ts`
- **Seeding** — `tools/seeding/src/{types,prompt,validate,extract}.ts`, the fixture, and **both
  prompts** (`docs/seeding/paste-json-prompt.md` + the bulk extractor)
- **Queued imports** — the **46 queued extraction payloads** encode `REG_OPEN`/`REG_CLOSE`. They need
  read-either-shape mapping, exactly as `entryPathwaySeeds()` does for `entryPathway`.
- **Tests** — `CatalogPersistenceTest`, `AdminApiIntegrationTest`, `EffectiveStatusTest`,
  `CatalogPublicApiIntegrationTest`, `CatalogSearchIntegrationTest`, and the web `*.test.ts` above
- **Docs** — `domain-model.md` §7a.2, `glossary.md`, `page-blueprints.md`, `legacy-reference.md`
  (source-path correction)

---

## 7. Why this shape survives the participant features

### 7.1 Windows gate features; points only notify

Owner intent (2026-08-30): a window's start and end are meant to **drive the product**, not just
render — the submission window opens the submission portal, the judging window opens the judging
portal. That makes arity load-bearing rather than cosmetic:

- A **window** has duration, so it can open and close access. It is a gate.
- A **point** has no duration, so it can only fire a notification ("results are out"). It is an event.

Two consequences. First, **gating must switch on `type`, never on `label`** — which is why `JUDGING`
is a type (§4.1). Second, the DB arity `CHECK` stops being tidiness and becomes a safety property:
a point type physically cannot hold an end date, so no gate can ever be opened by a row that has no
close date to shut it. Legacy's **F2** — registration typed as a point — would, under a gating model,
have been a window that opened and never closed.

### 7.2 Round vs. level-running vs. a separate Competition

Owner question, 2026-08-30. The structure is already decided — **Q3** (the live R1 rule) and **§8b**
(the Phase-3 target, owner-approved 2026-07-14, reaffirmed 2026-08-22). This section only draws out
what it means for the **timeline**.

**⚠ Terminology first — the word changes, the record does not.** A per-place running (Dallas
Regional, Nationals) is:

| | Today (R1) | Phase 3 (§8b) |
|---|---|---|
| the per-place running | an **`Edition`** | a **`Stage`** |
| the annual season | *(no record)* | a new **`Edition`** added *above* |
| linked upward by | `advances_to_edition_id` | `advances_to_stage_id` |

Q3: *"operationally distinct regional runnings (own dates/registration/results) ⇒ **separate**
Editions … Phase-3 target (§8b): these per-place runnings are renamed **Stages** under a single annual
Edition."* Below, **"level-running"** means that record under either name.

**A separate record is NOT a separate listing.** `slug` lives on `Competition` and the public route is
`/c/[slug]` — **one page per Competition**, with a region selector swapping in the chosen running's
dates and fees. §8b rejected the split-into-many-listings alternative precisely because it *"breaks
the evergreen slug/SEO asset"*; the goal is *"separation without fragmenting discovery into many
listings."*

**And none of it is in use yet.** Per §8b, *"admins curating external competitions keep the
single-running form — we don't hand-model someone else's regionals."* A multi-regional competition in
today's catalog is one Competition + one Edition + prose + a link to the host's "find your regional"
page. The multi-record shape exists in the schema and goes live with host tools.

#### The three-way test

| | Round | Level-running (`Edition` → `Stage`) | Separate Competition |
|---|---|---|---|
| What it is | a phase *within* one running (written → oral) | Texas Regional, Nationals | a different program |
| Splitting test (Q3) | — | own dates + own registration + own results | own identity, own slug, own page |
| Listing | same listing | **same listing** | its own listing |
| Roster | unchanged | participant is **promoted** onto the next running's roster | no roster moves at all |
| Re-register? | no | no — one registration per season (§8b) | **yes** |
| Link between them | `sequence` within the running | `advances_to` — an edge in one season's DAG | none; at most a "feeds into" pointer for discovery |
| Coupling verb | **unlock** | **promote** | **refer** |

So the real distinction is **who owns the roster**, not how big or serious the next thing is.
Advancement moves a person along an edge inside one program. A separate Competition has no edge — we
can link the two for discovery, but the participant registers themselves and nothing unlocks
automatically.

*(The "re-register" row describes the §8b participant flow. Q3's splitting test — same dates, same
registration, same results? — is the same question asked of the data, and is what decides the record
split today.)*

**Where access control lives — and where it does not.**

This is the part that matters for the timeline, and it removes a mechanism the legacy build had:

- **Across level-runnings, access follows the roster.** You advance → you are on the next running's
  roster → you see its timeline. The timeline row needs no audience rule, because the running already
  is the audience boundary. §8b's *"qualifiers appear on the next level's roster automatically"* is
  the whole mechanism.
- **Within one running, a Round may need a subset rule.** Here the roster does *not* change — the same
  registered participants are there, and only some unlock the oral round. This is the one place
  legacy's `segment_rule` (`ALL_PARTICIPANTS` / `ADVANCING_ONLY` / `CUSTOM_LIST`) earns its keep.

Legacy applied `segment_rule` to everything. Here it is needed **only for Rounds** — cross-level
access is a roster fact, not a timeline-row fact. That is a whole category of per-row audience logic
we do not have to build.

**Consequences for this plan** (forward-compatible, none of it built in `0025`):

- Key dates hang off `Edition` today and stay there. Under §8b's rename that same row becomes a
  `Stage`, and **`key_date` follows `scope_level`, fees and prizes down to it.** `0025` should not
  entrench the word `edition` in any new public contract.
- A Round's dates stay in `key_date` — one timeline table, per D3 — reached later by a nullable
  `round_id` FK. Rounds do not get their own date columns.
- `EVENT` is the right name precisely because of this split. §8b explicitly **rejected** carrying
  scope on timeline events: *"a timeline is sequence (when); scopes within a season are parallel
  instances (where)… ten regionals are ten simultaneous instances of ONE phase."* Ten regionals are
  ten level-runnings, never ten `EVENT` rows.

**🛑 Where this stops.** The *structure* above is open and decided. The **advancement rules engine** —
top-N, score threshold, judge-selected, and how judging produces that list — is `AdvancementRule`
[reserve] plus registry **H25 / HC5**, designed at **Gate A/B** (`development-process.md` §6a). The
three rule types the owner described are already sketched there; they are **not** to be designed,
schema'd or built here.

### 7.3 The later columns


The features named for later — submission windows, participant notes, event details — are all
*attributes of a timeline row*, which is precisely what legacy's `CompetitionStage` was. The path is
additive, and each step is a nullable column on `key_date` or a child table:

| later need | how it lands |
|---|---|
| event details / notes | `notes` markdown column (public) |
| participant instructions | `instructions_md` (gated on registration) |
| per-round resources | reuse the existing `resource` pattern, keyed to the row |
| submission windows | already a `SUBMISSION` row — nothing new |
| staged visibility | `visible_to_participants_at` |
| round dependencies | `depends_on_id` self-FK |

The reason this works is that **arity makes the row mean something**. A `SUBMISSION` window is a thing
you can hang an artifact spec on; a `SUBMISSION_DUE` instant is not. Legacy needed a parallel `stages`
table precisely because its `timeline` JSONB rows were untyped `{date, event}` pairs with nothing to
attach to — and then never retired the JSONB, producing **F3**.

`notes` is deliberately **not** in `0025`. It is one nullable column, but it needs form and prompt
support to be real, and an unused column is debt. It lands when the feature does.

---

## 8. Owner decisions and remaining questions

**Decided 2026-08-30:**

1. **`JUDGING` is in**, carrying dates only. Everything it gates stays 🛑 Gate A.
2. **Sequencing: after the 200-competition content gate.** Both prompts and the queued payloads keep
   the current shape until then; every listing seeded before this lands is one more row to remap,
   which is the accepted cost.

**Still open:**

3. ~~`all_day` and the midnight-deadline defect.~~ **Done 2026-08-30** — the display bug is fixed
   (§4.4); `all_day` is downgraded to optional and no longer blocks `0025`.
4. ~~`CUSTOM` → `MILESTONE` rename.~~ **Closed 2026-08-30 — no rename.** `Milestone` is a reserved
   glossary term (HC7); see §4.1.
5. ~~Glossary entries.~~ **Done 2026-08-30** — `Key date`, `Window` and `Point` are in `glossary.md`,
   and the `Milestone` row now records why the rename was dropped.

**Newly open:** the curation form's "Milestone" field label and the prompts' loose use of the word
both refer to a **Key date**. Pre-existing, low-risk, and worth a small copy pass before `0025`.

## 9. If this is deferred

The cheap partial that fixes the reported symptom without a migration: **stop offering `endsAt` on the
point types** in `key-date-manager.tsx` — hide the end-date control for `REG_OPEN`, `REG_CLOSE`,
`SUBMISSION_DUE` and `RESULTS`, leaving it on `ROUND_START` and `CUSTOM`. This removes the nonsense
end-date input the question is about and costs nothing. It does **not** merge registration into one
row, so it treats the symptom and leaves **F1** in place — the schema still permits what the form now
hides.
