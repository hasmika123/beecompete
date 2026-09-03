# BeeCompete — Domain & Data Model

**Status:** Living document · **Last updated:** 2026-07-18 (R1-1 as-built) · Depends on: `glossary.md`, `feature-registry.md`

The foundation. This turns the strategy, feature registry, and foundation hooks into an actual
data model that supports **all three facets from day one** — even though we build them in phases.
Terms are as defined in `glossary.md`. Assumes a **relational DB with strong JSON support
(Postgres)**; final stack is confirmed in the Architecture doc.

> **Scope note:** entities marked **[P1]** are built for the Phase-1 marketplace. Entities marked
> **[reserve]** are *modeled now but built later* — we define the shape so there's no migration,
> and detail them in each facet's just-in-time deep-dive. This is the "design-in hook" discipline.
>
> A third marker, **[deferred-design]** (added 2026-07-07), covers judging and science-fair
> compliance: **deliberately not designed yet** — no shape is committed until their 🛑 design gates
> (`development-process.md` §6a, Gates A/B). P1's only obligation for these is to avoid *blocking*
> assumptions: stable IDs to hang future tables on; no single-round / single-level assumptions
> baked into `Edition`.

---

## 1. Design principles (the big decisions)

**D1 — Typed Spine + validated JSON attributes.** The central challenge (one schema for every
competition type) is solved with a hybrid:
- **Typed columns** for the *Spine* — the fields we filter, sort, or join on (category, grade
  range, region, dates, cost, format). Fast and indexable.
- A **validated `attributes` JSONB bag** for category-specific fields (e.g., ISEF form set,
  robotics league). Each Category has a **Category Template** holding a **JSON Schema** that
  validates the bag.
- **Rule:** *filter/sort/join on it → typed column; display-only or category-specific → JSONB.*

**D2 — Two-level Competition ↔ Edition.** Evergreen `Competition` owns identity/resources/reputation;
`Edition` owns dates/registration/results. Never merge them.
*(Field allocation revised 2026-09-01 — §8c: the Competition now keeps permanent identity ONLY;
all yearly listing content — incl. description, eligibility, judging display, FAQ, resources —
lives on the Season/`Edition`. The two-level split itself is unchanged.)*

**D3 — Timeline as data, not columns.** An Edition's dates are rows in `KeyDate` (typed events),
not fixed columns — so any timeline shape works.

**D4 — Generic parties & payments.** `User`, `Organization`, `Entitlement` are generic so that
host/school/sponsor and payer≠beneficiary all fall out without special cases (keeps "free for
schools" and "sponsorship" as later config, not migrations).

**D5 — Derive progress from an Event Log.** No bespoke progress columns anywhere. All progress
(participant, cohort, parent views) is aggregated from one append-only `ActivityEvent` stream.

**D6 — Structure is entities, not flags.** Divisions, Rounds, and Advancement are first-class
records because academic competitions are routinely multi-division, multi-round, and multi-level —
K-12 ones especially, and collegiate ones no less.

**D7 — Soft-delete + event-log audit; no temporal tables** *(locked 2026-07-07)*. Curated records
are **never hard-deleted** (their slugs carry SEO and inbound links): archive via `archived_at` /
status instead. Field-level change history = `ActivityEvent` rows (verb `updated`, payload = diff) —
no separate versioning/history tables. User-submitted corrections (DQ6) are rows in a
**`CorrectionProposal`** queue that curators approve; the main tables are never versioned.

---

## 2. The six open questions — resolved

| # | Question | Decision |
|---|---|---|
| Q1 | **Category set** for launch | A two-level taxonomy (Category → Subcategory), seeded with ~10 top academic-competition categories: Math · Science & Engineering · Computer Science/Coding · Robotics · Debate & Speech · Business/Entrepreneurship (CTSO) · Writing & Essay · Arts & Music · Academic Bowl/Quiz · History/Geography/Civics · (+ "Other"). This is **seed config, not schema** — the taxonomy table grows freely. |
| Q2 | **Grade/age** representation | Store **both**: a normalized **grade range** (`min_grade`/`max_grade`) as the *primary* eligibility/filter axis, and an optional **age range** (`min_age`/`max_age`) for age-gated or international competitions. A Participant has a grade + DOB (→ age). **Encoding locked (2026-07-07):** `smallint` — **Pre-K = −1, K = 0, grades 1–12 = 1–12; 13–16 = the four undergraduate years (College freshman → College senior), 17 = Graduate** *(post-HS rungs activated 2026-08-23, split into named college years 2026-08-24 by owner — a single “College” rung couldn’t say whether a competition was freshman-only or open to all four; “grade” stays the canonical term, the post-HS rungs are named levels on the same ladder — UI renders them without the “grade” prefix: “Grades 9–College freshman”, “College freshman+”. The 13/14 = College/Graduate encoding held for one day and no row ever used it, so the renumber needed no migration)*. Homeschool/ungraded map to the age-equivalent grade. Age-gated comps filter on age (from DOB); grade-gated on grade. **Refined 2026-08-28 (owner) — `eligibility_basis`:** storing both ranges never said WHICH one the organizer stated, so every summary surface rendered grade as fact — including grade ranges the seeding extractor had DERIVED from an age rule (Breakthrough Junior Challenge: states ages 13–18, we published "Grades 7–12"). The new Spine column `eligibility_basis` (`GRADE|AGE|BOTH|OPEN`, null = not stated) splits the two jobs the grade range was doing at once: the **stated** axis drives DISPLAY (card badge, At-a-glance strip, Eligibility tab), and BOTH normalized ranges drive SEARCH, derived where absent. Q2's locks all hold — both ranges are still stored and grade is still the primary filter axis; what changes is that a derived range may never be shown as a rule, and a null range means **"not stated"**, never "all grades". Derivation is `grade = age − 5`, clamped to the ladder, server-side only, and is deliberately lossy (age 18 → grade 12 or 13) — which is exactly why it cannot carry a stated rule's authority. Plan + build order: `eligibility-basis-plan.md`. **Profile storage (locked 2026-07-07):** participants store **`grad_year`** as canonical; grade is *derived* (UI asks grade, converts on save) — so profiles never go stale at school-year rollover. |
| Q3 | **Region** granularity | Structured geo, not free text: **Country → State → County/District → City**, plus a special **"Virtual/Online"**. Each Edition has a `scope_level` (international/national/state/regional/local/virtual) + associated region(s). **`INTERNATIONAL` added 2026-08-20** — the S3 seeding sweep hit ISEF and FIRST Robotics, both genuinely multi-country, and without the token the extractor stored `NATIONAL` for them; it means the *running draws entrants from multiple countries*, not that a US event accepts foreign entrants. No migration: `scope_level` is a `VARCHAR(20)` with no CHECK constraint. US-first ⇒ **State** is the primary filter granularity; District enables chapter scoping. **Multi-region rule locked (2026-07-07):** the region join is **Edition-level** (`EditionRegion`). Test: **one registration = one Edition** — same dates + same registration + same results ⇒ **one** Edition tagged with many regions (e.g., AMC 10 2026 nationwide); operationally distinct regional runnings (own dates/registration/results) ⇒ **separate** Editions (e.g., Dallas vs. Houston regional fairs), linked upward via `advances_to_edition_id` — exactly the advancement chain. A Competition's region facet in search is *derived* from its Editions. **Phase-3 target (§8b):** these per-place runnings are renamed **Stages** under a single annual Edition (not separate Editions); R1 keeps this interim separate-record form. |
| Q4 | **Division** representation | A generic `Division` per Competition with a name + flexible criteria (grade range and/or skill label). Not hard-coded — each Competition defines its own (Junior/Senior, Novice/Varsity, etc.). A participant maps to a Division at registration. **Placement locked (2026-07-07): `Division` lives on `Competition`** (stable identity across years — needed for history/analytics) with an **`active` flag**; restructures add new rows + deactivate old ones, never edit existing rows. `Registration` **snapshots the resolved division** at registration time, so later definition changes never rewrite past records. No per-Edition division copies. |
| Q5 | **Round / advancement** | Two mechanisms: **`Round`** = a sequential phase *within* an Edition; **Edition linkage** (`advances_to_edition_id`) = multi-level advancement *across* Editions (school→regional→state→national). `AdvancementRule` (top-N / threshold / judge-selected) attaches to a Round or linkage. Structure is represented at launch; *enforcement* lands with the Phase-3 host tools (H25/HC5 — moved 4→3 by registry Rev 5; designed at Gates A/B). Rules are data, not code. |
| Q6 | **Team composition** | A `Team` is Edition-scoped (name, division) with `TeamMember` rows. A `Registration` is polymorphic — registrant is **either** a Participant **or** a Team. Teams form via a Group (coordinator) or self-organize (team-finder). Size bounds come from the Competition's Format. |

---

## 3. Entity catalog

### 3a. Competition domain

**`Competition`** [P1] — the evergreen entity.
`id, slug, name, organizer_org_id?, official_url, logo, description, category_id, tags[],
participation_mode (individual|team|both), team_size_min?, team_size_max?, delivery
(in_person|virtual|hybrid), entry_pathway (individual|school_or_chapter|either), evaluation_type[],
min_grade?, max_grade?, min_age?, max_age?, cost_type (free|paid), recurrence
(annual|one_off|rolling), attributes (JSONB), provenance{...}, verification_state, archived_at?,
created_at` *(soft-delete per D7)*
*(`entry_pathway` added 2026-07-08, legacy review: whether a student can enter independently or
only through a school/chapter — filterable, shown in the Details at-a-glance strip.)*

> **Identity keys + the duplicate rule (DQ4 Phase-1 slice, 2026-09-03, migration `0026`;
> `duplicate-detection-plan.md`).** `name_key` and `url_key` are **stored generated columns**
> computed by two IMMUTABLE SQL functions, `catalog_name_key(text)` (lowercase, every run of
> non-alphanumerics → one space, trimmed; Unicode letters kept, accents not folded) and
> `catalog_url_key(text)` (lowercase, scheme / leading `www.` / query / fragment / trailing slashes
> dropped). `import_record` carries the same two keys from its JSONB payload and `organization`
> carries `name_key`, so every row is comparable from the moment it exists, whatever wrote it.
> **Java never re-implements the normalization** — lookups bind the raw value and let SQL key it
> (`WHERE name_key = catalog_name_key(:name)`), so the two sides cannot drift.
> **The one hard rule:** two *live* competitions may not share a `name_key`
> (`uq_competition_name_key_live`, partial on `archived_at IS NULL`). Same-named live listings are
> indistinguishable on a card whatever else differs, so the fix is always to rename one; the index
> is what makes a concurrent-create race lose instead of succeed. The write gate
> (`CompetitionCurationService.guardDuplicates`) answers it with a 409 *before* the index fires.
> **Soft signals** — same `url_key` (umbrella programs legitimately share a page), a similar name
> (`pg_trgm` similarity ≥ 0.45 or one key containing the other), or an *archived* same-name row —
> are a 422 listing the candidates unless the request carries `confirmNotDuplicate: true`; same
> shape as `confirmNewOrganizer`. `update` re-gates only when the name or URL actually changed.
> **No** unique index on `url_key`, and **none** on `organization.name_key` (the `0012` decision
> stands). Everything is computed in one place, `DuplicateDetectionService`, which also serves
> `GET /admin/competitions/duplicates` + `GET /admin/organizations/duplicates` (the forms warn
> before submit), the import queue's per-row `duplicate` / `pendingTwins` flags, and the seeding
> tool's known-listing pre-check.
> **Retiring a found duplicate (PR 2, migration `0027`):** `duplicate_of_competition_id` (self-FK)
> names the **canonical listing** a row was archived in favour of. `POST
> /admin/competitions/{id}/mark-duplicate` sets it together with `archived_at` (drops the featured
> slot, as archive does); `restore` clears it. DB CHECKs hold "never itself" and "only on an
> archived row"; the service refuses an archived or itself-duplicate canonical and **re-points**
> anything already pointing at the row being marked, so a redirect is always one hop.
> `GET /api/v1/competitions/{slug}/canonical` answers where a retired slug went, and `/c/[slug]`
> issues a **permanent redirect** to it. Content **merge** (moving seasons/resources between a
> duplicate and its canonical) is not built — DQ4 Phase 2.

> **Standard attributes-bag keys** *(2026-07-08 — conventional JSONB keys, not Spine columns;
> validated per Category Template where relevant):* `eligible_countries[]`,
> `citizenship_countries[]`, `student_status_required` (**boolean** since `0022`, owner
> 2026-08-26 — "must entrants be enrolled students, yes or no"; it was free text until then, and
> the prose curators had written into it was discarded, not migrated),
> `other_eligibility_requirements` (international/eligibility depth) and `syllabus` / `topics[]`
> (feeds Participant+ practice content + recommender, → P8).
> ⚠ The typed/prose split across those last two is the point: a *fact* about eligibility is a
> key; a *sentence* about it belongs in `other_eligibility_requirements` (added by `0017` for
> exactly this reason). Never widen a typed key back into prose to fit one listing.
> ⚠ The two **country keys are slated for JSONB→Spine promotion** (filterable columns) at
> Phase 3 with H36 — owner 2026-08-18, plan in `sweep-remediation-plan.md` §16. Until then they
> render under the detail page Eligibility group (#82) but cannot be filtered on. Since
> 2026-08-23 the admin form's Eligibility tab writes them through typed inputs, and since
> **2026-08-24 the two country keys are CLOSED vocabularies** — `eligible_countries` is one of
> United States / Canada / Other, `citizenship_countries` is United States or nothing (owner:
> free-typed spellings can never be filtered on, so the promotion would have inherited dirty
> data). Each still stores a one-element array, so the shape is unchanged. The closure is what
> ⚠ **Vocabularies revised 2026-08-28 (owner).** `eligible_countries` is now **Open to all /
> United States / Canada**; `citizenship_countries` is **Open to all / United States**.
> **"Other" is retired** — no row ever stored it, and anything the list cannot say belongs in
> `other_eligibility_requirements` anyway. **"Open to all" is new and IS stored**, because "the
> organizer says anyone may enter" and "the page never mentions countries" are different facts and
> an absent key could only ever express the second. The admin form's third option, *Not provided*,
> is that absent key; both fields are required there, and the public Eligibility tab now renders
> all three gates unconditionally so a missing row can no longer be read as "no such rule".
> > `other_eligibility_requirements` exists for: the prose catch-all (added 2026-08-24, `0017`,
> declared on every template) that absorbs what the closed lists can't say — including what a
> curator meant by "Other". It is deliberately NOT promotion-bound; nothing filters on prose.

**`Edition`** [P1] — one running of a Competition. *(UX word: **Season**. §8c (2026-09-01) makes it
the owner of ALL yearly listing content — the R2 rebuild in `sweep-remediation-plan.md` §19 adds
the migrated columns; the shape below is the as-built R1 schema.)*
`id, competition_id, cycle_label ("2026"), status (upcoming|open|closed|ongoing|archived),
registration_url, entry_fee?, currency?, age_cutoff_date?, prize_summary?, prize_value?,
prize_currency?, scope_level, advances_to_edition_id?, attributes (JSONB), provenance{...},
archived_at?, created_at` *(soft-delete per D7)*
*(2026-07-08 additions: `age_cutoff_date` — age eligibility computed "as of" this date, the way
competitions actually state age rules; `prize_summary`/`prize_value`/`prize_currency` — the typed
display/sort fields behind the card + at-a-glance Prize; structured detail lives on `Award`.)*

**`KeyDate`** [P1] — typed timeline events on an Edition.
`id, edition_id, type (reg_open|reg_close|round_start|submission_due|results|custom), label?,
starts_at?, ends_at?, timezone`
*(2026-07-13, R1-18 / migration `0008`: `starts_at` is nullable — NULL = the milestone exists but
its date is **TBD**, allowed on any type. Rules + the timezone semantics live in §8.)*

**`Category`** [P1] — taxonomy node. `id, parent_id?, name, slug`
**`CategoryTemplate`** [P1] — `id, category_id, json_schema (JSONB), ui_hints (JSONB)` — validates a Competition's `attributes`.

**`Division`** [reserve] — `id, competition_id, name, min_grade?, max_grade?, skill_label?, criteria (JSONB), active (bool)` — on Competition (locked, Q4); `Registration` snapshots the resolved division.
**`Round`** [reserve] — `id, edition_id, sequence, name, type (qualifier|regional|final|custom), evaluation_type`
**`AdvancementRule`** [reserve] — `id, round_id? | edition_link?, rule_type (top_n|threshold|judge_selected), params (JSONB)`
**`Award`** [reserve] — `id, edition_id, division_id?, round_id?, name, place?, award_type
(monetary|non_monetary|scholarship|travel_grant|other), value?, currency?, description?,
display_order` *(added 2026-07-08 → H47; shape informed by the legacy prototype,
`legacy-reference.md`. Assignment of Awards to winners is judging territory — designed at Gate B,
never before.)*

**`Region`** [P1] — `id, parent_id?, level (international|country|state|county|city|virtual), name, code`
*(`virtual` level added at R1-1 build, 2026-07-12 — the Q3 special "Virtual/Online" region needs a
level so virtual Editions can carry a region row. **Seeded** at sweep item 15, 2026-07-16, Liquibase
`0010`: US + 50 states + DC + ~25 major cities + `Virtual / Online`; **`0018` (2026-08-24) widened
the city rung to the top ~1000 US cities** — so admins pick, not hand-create; more (Canada,
counties) via admin CRUD. **`0025` (2026-09-03) adds the `international` level and its single row `International / Worldwide`** — the region-side partner of `scope_level=INTERNATIONAL`: the registry is US-only, so a multi-country running had no honest tag (empty fails the required region on create; `United States` publishes it as US-only in the marketplace filter). It never parents a country row, and a running with a physical venue still carries that venue too. No migration for the column — `level` is `VARCHAR(20)` with no CHECK, same as `scope_level`. City coverage is an ADMIN convenience only: `/api/v1/regions` lists just
the regions carrying a live listing, so the marketplace filter is unaffected by the seed size. The grouped/searchable admin picker is
`region-picker.tsx`.)*
⚠ **None of this structure survives into the public search projection**: `CompetitionSummary.regions`
is a flat `string[]` of NAMES — no `level`, no `code` — so the web re-derives both by name matching
against a hand-written map (`apps/web/src/lib/us-states.ts`). Planned fix (`RegionRef {name, code?,
level}`, DTO-only, no migration): **`sweep-remediation-plan.md` §12**, batched with the
`prizeKind`/`prizeValue` summary fields in §15 so the projection is touched once.
**`EditionRegion`** [P1] — join: which regions an **Edition** covers *(locked 2026-07-07; renamed from `CompetitionRegion` — the join is Edition-level, never Competition-level)*. One registration = one Edition (Q3); the Competition's region filter is derived from its Editions.

**`Resource`** [P1] — curated prep/reference link on a Competition. *(Re-homed to the Season at
§8c/R2 — gains `edition_id`; year-stamped guides made per-season honest. As-built R1 shape below.)*
`id, competition_id, title, url, type (book|past_paper|guide|video|other), is_affiliate, affiliate_meta (JSONB), display_order, created_at`
*(`display_order` added at R1-1 build — the details Resources row is a curated, ordered strip.)*
*(Affiliate convention, 2026-08-25: the only network so far is **Amazon Associates** — tag
`beecompete-20`. An Amazon link is stored with the `?tag=beecompete-20` query already on the `url`,
`is_affiliate = true`, and `affiliate_meta` recording at least `{"network": "amazon", "tag":
"beecompete-20"}` so the tag can be re-pointed in bulk if the Associate ID ever changes.)*

**`CompetitionFaq`** [P1] — curated per-competition FAQ entry (glossary: **FAQ Entry**; details
FAQ tab + FAQPage structured data → R1-7; shape decided at R1-1 build, 2026-07-12). *(Re-homed to
the Season at §8c/R2 — gains `edition_id`; answers like "when is registration?" change yearly.)*
`id, competition_id, question, answer, display_order, created_at`
— ordered child rows (not a JSONB array on Competition) so the admin tool (R1-3) CRUDs entries
individually and FAQPage markup iterates them in order.

### 3b. Parties, accounts & groups

**`User`** [P1] — base account. `id, email, auth{...}, display_name, member_id? (unique, reserved),
primary_persona (participant|parent|educator|host|admin), created_at`
*(A user can hold multiple roles/profiles — persona is a UX default, not a hard type. `member_id`
= public member handle, reserved 2026-07-08: Phase-3 team/roster invites go by member ID so a
minor's email is never exposed — → H7/M18.)*

**`ParticipantProfile`** [P1] — for student users.
`user_id, date_of_birth, grad_year, region_id?, interests[], consent_state`
*(Canonical field is **`grad_year`** — graduation year; **grade is derived** from grad_year + the
current school year. The UI still asks "grade" and converts on save. Locked 2026-07-07: prevents
profiles silently rotting every fall as students advance a grade — no rollover job needed.)*

**`GuardianLink`** [P1] — parent↔child. `id, guardian_user_id, child_user_id, relationship, status(pending|active|revoked), consent_record_id, created_at`

**`ConsentRecord`** [P1] — COPPA consent audit trail. `id, child_user_id, guardian_user_id, method(email_plus|payment|id), scope, disclosures_version, granted_at, confirmed_at?, revoked_at?, ip` — the legal record of *who* consented, *when*, and *to what version* of our disclosures. See `rfc-p1-auth-consent.md`. *(Auth-mechanics entities — `AuthCredential`, `Session` (Spring Session JDBC; no refresh tokens — sessions decision 2026-07-07), `AuthToken` — also live in the accounts module per that RFC.)*

**`Organization`** [P1] — generic institutional party.
`id, name, type (host|school|sponsor|other), domain?, verification_state, provenance{...}`
*(Built at **R1-1** (2026-07-12), not R2: the CompetitionCard/details attribute the organizer by
name and the DQ13 seal sits on the ORG, so it's catalog data. `Membership`/`Role` wait for User
at R2-1.)*

> **Organizer is mandatory (2026-07-16, migration `0012`).** `Competition.organizer` is `NOT NULL`
> — every write path must attribute a listing. The single competition write path
> (`CompetitionCurationService`, shared by admin CRUD, import-approve, and the combined create)
> **resolves-or-creates** the organizer: a given `organizerOrgId` must exist; otherwise it resolves
> `organizerName` by an **exact name-key match → reuse** (since `0026` the DB key: case,
> punctuation and whitespace folded), and creates a fresh org when there is no match. Auto-created
> orgs are **`CURATED`/`HOST`** (unclaimed, no R1 verification work) with `domain` inferred from
> the official URL and the competition's provenance stamp. Conservative by decision: a name that
> only matches **similar** orgs — containing either way, trigram-similar, or **a different org on
> the same registrable domain** (DQ4, 2026-09-03) — is **refused (422, listing candidates with
> their match reasons)** unless the curator sets `confirmNewOrganizer` — no auto-merge (a wrong
> merge is worse than a duplicate). An exact match that is **archived** is a 422 (restore or pick
> another). A row with **no organizer** is flagged for manual assignment (the seeding pipeline
> sends `organizerName: null`, never a placeholder). No unique index on `organization.name_key` —
> R2 will legitimately hold same-named schools; the single-curator R1 accepts the create race.
> Lets the S4 seeding pipeline attribute 200+ imports by name without pre-creating orgs by hand.
> The matching itself lives in `DuplicateDetectionService` (shared with the competition gate), and
> since DQ4 the **direct** `POST/PUT /admin/organizations` path is gated the same way: a live
> exact name → 409 pointing at it; archived exact / same domain / similar → 422 unless
> `confirmNotDuplicate`.

**`Membership`** [P1] — `id, user_id, org_id, role_id, status`
**`Role`** / **`Permission`** [P1] — org-scoped RBAC. `Role{id, org_id?, name}`, `Permission{role_id, action, resource}`

**`Group`** [reserve] — educator-managed set. `id, owner_user_id?, org_id?, name, type (class|club|cohort|chapter)`
*(Chapter note, 2026-07-08: a chapter Group may be **affiliated to a Host organization** — a
CTSO-style network chapter with join codes, founding applications, and lead/co-lead/mentor/student
roles — not only an educator-created school group. Phase-3 registration (H7/E8) must support
host-network chapters as the entry vehicle for `entry_pathway = school_or_chapter` competitions.
Mechanics reference: `legacy-reference.md` §1.)*
**`GroupMembership`** [reserve] — `id, group_id, participant_user_id, added_by`

**`Team`** [reserve] — `id, edition_id, name, division_id?`
**`TeamMember`** [reserve] — `id, team_id, participant_user_id, role_in_team?`

### 3c. Journey, tracker & progress

**`ParticipantCompetition`** [P1] — the Journey record; backbone of the Tracker.
`id, participant_user_id, competition_id, edition_id?, status (saved|registered|preparing|
submitted|completed|result), is_external (bool), saved_at, updated_at`
*(Works for external competitions: `edition_id` null, `is_external` true. Coarse status lives here;
detailed progress is derived from the Event Log.)*

**`ActivityEvent`** [P1] — append-only event log (Foundation Hook #9).
`id, actor_user_id?, subject_type, subject_id, verb, payload (JSONB), occurred_at`
*(All progress views — participant, cohort P25/E6, parent PA4 — are aggregations over this.)*

### 3d. Money & entitlements

**`Product`** [reserve, minimal P1] — catalog. `id, code (participant_plus|host_starter|host_pro|
host_championship|public_listing|promotion|sponsorship), tier, pricing (JSONB)`
*(`public_listing` added 2026-07-08: publishing a self-created competition publicly is gated on
this entitlement — included in every paid host tier; free-promo grants are just zero-price
entitlement rows, so "free now, charged later" is config, not a migration. `monetization.md` §4.)*

**`Entitlement`** [reserve] — the one abstraction behind every purchase (Hook #12).
`id, product_id, scope_type (competition|edition|category|platform), scope_id, beneficiary_type
(user|org), beneficiary_id, payer_type (user|org), payer_id, status, valid_from, valid_to`

**`Order`** / **`Payment`** [reserve] — `Order{id, payer_id, total, status}` → many `Entitlement`s;
`Payment{id, order_id, stripe_ref, amount, status}`.
*(Bulk/cohort = one Order → many Entitlements allocated to students. Promotion & sponsorship = an
Entitlement with a broader `scope_type`. Nothing special-cased.)*

### 3e. Content, prep & host-side *(mostly reserved — detailed in Phase 2/3/4 deep-dives)*

- **`PrepPackage`** [reserve] — Participant+/² content bundle attached to a Competition; access gated by Entitlement.
- **`Registration`** [reserve] — participant **or** team ↔ Edition (polymorphic registrant).
- **`Submission`** [reserve] — entry to an Edition, belongs to a Registration.
- **`JudgingAssignment` / `Score` / `Rubric`** [deferred-design] — 🛑 **no shape committed**; designed at **Gate B** (judging deep-dive, `development-process.md` §6a), driven by what Gate-A fairs actually need. Basic judging builds in Phase 3, advanced modes Phase 4.
- **`Listing` state** is not a separate table — it's the `Competition`'s `listing_status` + `approved_at` (**R1 lifecycle, see §8a**) + its `Edition`s + provenance a Host/Admin manages. *(Phase 3, → H48: self-created competitions gain a `visibility` field (public|link-only|invite-only — renamed 2026-07-14, §8a); setting it to `public` requires host verification (DQ11–DQ14) **and** a `public_listing` entitlement (2026-07-08). Free tier enforces a participant cap 🔬 + volume limits. Curated listings are public by definition and unaffected.)*
- **`ComplianceForm` / `ReviewCommittee`** [deferred-design] — 🛑 **no shape committed**; designed at **Gate A** (science-fair wedge deep-dive, `development-process.md` §6a) from fair-director research. Consent is partly P1 via `GuardianLink`/`consent_state`.

**Community articles (Phase 2 — M19/M34/M35; Rev 9, 2026-07-08).** Additive-by-design (Hook #15);
sketches, not contracts:

- **`Article`** [reserve] — admin-published content. `id, slug, title, summary?, body (rich
  text/structured JSONB — format decided at build), cover_image?, author_admin_id, status
  (draft|published|archived), published_at?, archived_at?` — soft-delete + X14 status per house
  rules. Public surface label is **"Community"** (glossary); entity is always Article.
- **`ArticleCompetitionLink`** [reserve] — join: `article_id, competition_id, position` — "linked
  competitions" rendered in-article as CompetitionCards.
- **`ArticleReaction`** [reserve] — `article_id, user_id, kind (like|love), created_at`; unique
  (article, user). **Logged-in non-minor users only** (age from `ParticipantProfile` DOB/grad-year);
  counts public, reactors never listed.
- **`ArticleComment`** [reserve] — `article_id, user_id, body, status (pending|approved|rejected|
  removed), created_at` — **adult-visible-only, read and write** (owner 2026-07-08): the comment
  section renders only for logged-in non-minor users; minors and logged-out visitors never see it.
  Moderated via DQ8 (post-moderation viable — no minor audience), reportable via DQ7. Builds only
  after R2 accounts + the moderation queue exist.

### 3e-bis. Site content (Landing) *(P1 — M36, Rev 9)*

- **`HeroCard`** [P1] — the 3 admin-managed hero image cards. `id, position (main|top_right|
  bottom_left), image_key (S3), alt_text, link_url? (main card), description? (hover-scrim text,
  main card), updated_by, updated_at` — exactly one active row per position.
- **`FeaturedSlot`** [P1] — admin-picked Landing carousel entries. `id, competition_id, position,
  updated_by, updated_at` — ordered, 6–10 max (blueprint carousel rules). Editorial, not paid
  (M28 Promotion arrives later, labeled, as its own thing).
- **`ValuePropCard`** [P1] — the 2 admin-managed promo cards in the Landing "Competing changes
  what's possible" section. `id, position (LandingSlot: primary|secondary), image_key? (S3 —
  null → the code-defined gradient+icon fallback keeps the approved look), link_url, label
  (hover text), updated_by, updated_at, version` — one active row per slot (migration `0011`).
- **`LandingStat`** [P1] — the 2 admin-managed admissions stats beside those cards. `id, position
  (LandingSlot), value (the figure), label (the line), source? (attribution — the §3 credibility
  rule wants sourced, non-causal numbers before launch), updated_by, updated_at, version` — one
  active row per slot (migration `0011`). Seeded with the pre-R1 hardcoded copy so the page is
  unchanged until an admin edits it.

### 3f. Provenance & trust (embedded)
Provenance is a reusable embedded structure on Competition/Edition/Organization:
`provenance{ source (curated|import|host_submitted|crowdsourced), last_verified_at, confidence }`
plus `verification_state (curated|claimed|verified|unverified)`. Host verification records and the
moderation queue (DQ11–DQ14) reference these.

> **Trust model (owner 2026-07-13; built in R1-19 / sweep-remediation §A2).** Trust lives on the
> **Organization only**, as a ladder — `CURATED` (unclaimed; verification does not apply) →
> `CLAIMED` (host claimed, not verified) → `VERIFIED` (claimed + identity verified; verified
> implies claimed). `UNVERIFIED` is **retired** (org writes reject it, migration `0009` folded
> existing rows to `CURATED`). **Competitions/Editions carry no trust state of their own** — never
> verified/unverified, and not individually claimed/curated: their maintainer is **derived from
> the organizer org** (org claimed/verified ⇒ all its competitions are host-maintained; org
> curated or no organizer ⇒ curated by BeeCompete; see `lib/catalog-display.isHostMaintained`).
> Claiming an org claims all its competitions by derivation — no cascade writes. The
> Competition/Edition `verification_state` column is kept but **vestigial** (held at `CURATED`,
> never read). The verified seal (DQ13) is org-level; the detail trust panel + card show only that.

**`CorrectionProposal`** [P1] — user-submitted corrections queue (DQ6, per D7):
`id, subject_type (competition|edition|resource), subject_id, submitted_by_user_id?, payload (JSONB
field-level diff), note?, status (pending|approved|rejected), reviewed_by?, reviewed_at?, created_at`
— curators approve/reject; approved diffs are applied to the main record (and logged as
`ActivityEvent`s). The main tables are never versioned.

---

## 4. Relationship map (core)

```
Category ──< Competition >── Organization (organizer / host)
   │             │  │
CategoryTemplate │  ├──< Edition ──< KeyDate
                 │  │        ├──< Round ──< AdvancementRule
                 │  │        ├──< Award [reserve]
                 │  │        └──< EditionRegion >── Region
                 │  ├──< Division
                 │  └──< Resource
                 │
User ─┬─ ParticipantProfile ──< ParticipantCompetition >── Competition/Edition
      ├─ GuardianLink ── (child) User
      ├─ Membership >── Organization ──< Role
      └─ GroupMembership >── Group ──(forms)──< Team ──< TeamMember

Entitlement ── Product ;  Entitlement.scope → Competition|Edition|Category|Platform
Order ──< Entitlement ;  Order ── Payment
ActivityEvent → (any subject)   // progress derived here
```

---

## 5. What we actually build in Phase 1

To avoid over-building, Phase 1 implements only:
- `Competition`, `Edition`, `KeyDate`, `Category`, `CategoryTemplate`, `Region`, `EditionRegion`, `Resource`, `CompetitionFaq`
- `User`, `ParticipantProfile`, `GuardianLink`, `Organization`, `Membership`, `Role`/`Permission`
- `ParticipantCompetition` (Tracker), `ActivityEvent`
- `provenance`/`verification_state` fields; `CorrectionProposal` (DQ6 corrections queue); minimal `Product` stub
- `HeroCard`, `FeaturedSlot`, `ValuePropCard`, `LandingStat` (M36 admin-managed Landing content — §3e-bis)

Everything else (`Division`, `Round`, `Team`, `Entitlement`, `Registration`, `Submission`, prep,
judging, compliance, **Article + its joins** — Hook #15) is **reserved** — the columns/relations
are designed here so later phases add tables and logic without reshaping the Phase-1 core.

---

## 6. Deferred to per-phase deep-dives
*(Reusable design detail from the legacy prototype — state machines for Registration/Team/stages,
form-builder taxonomy, practice engine, chapter mechanics — is preserved in `legacy-reference.md`;
mine it when each phase opens.)*
- **Phase 2:** PrepPackage content model, entitlement/checkout flows, Group/cohort mechanics, progress-derivation queries, **Community articles** (Article body format + reactions/comments UX; comments land with DQ8 moderation — §3e sketches).
- **Phase 3:** Registration/Submission, host verification workflow, Team formation, promotion placement, **science-fair wedge** — compliance (ComplianceForm/ReviewCommittee), basic judging (Rubric/Score), multi-level advancement enforcement. 🛑 All wedge/judging design happens at **Gates A/B** (`development-process.md` §6a) — never ahead of them.
- **Phase 4:** Advanced judging (modes, normalization, blind/COI), UGC creator content model.

## 7. Open modeling questions — status (updated 2026-07-07)

**Resolved — locked above, no ambiguity remains:**
- ✅ **Grade encoding** → Q2: `smallint`; Pre-K = −1, K = 0, grades 1–12 = 1–12; 13–16 = College freshman–senior, 17 = Graduate (post-HS activated 2026-08-23, split into college years 2026-08-24).
- ✅ **Division placement** → Q4: on `Competition`, `active` flag, snapshot at registration.
- ✅ **Soft-delete / versioning** → D7: soft-delete (`archived_at`) + `ActivityEvent` diffs + `CorrectionProposal` queue; no temporal/history tables.

- ✅ **Multi-region Editions** → Q3: region join is **Edition-level** (`EditionRegion`); rule = *one registration = one Edition* — same dates/registration/results ⇒ one Edition, many regions; operationally distinct runnings ⇒ separate Editions linked via `advances_to_edition_id`.

**All pre-R1-1 modeling blockers are resolved (2026-07-07) — the R1-1 schema migration is unblocked.**

## 7a. PENDING schema batch — run BEFORE bulk seeding (owner 2026-08-23)

Changes that are **decided but deliberately not yet executed**. Owner is batching them so the
~200-listing seeding run (`phase-1-plan.md` → R1 content gate) writes data under the FINAL model
exactly once — re-curating rows written under a superseded shape is the expensive order.

**Gate rule: this batch must be empty (or consciously waived) before S4 bulk curation begins.**
Add new items here as they are decided; each entry carries enough detail to execute without
re-deriving the design.

---

### 7a.1 `entry_pathway` → multi-select `entry_pathways` — ✅ **BUILT 2026-08-28** (migration `0024`)

**Why.** Entry pathway is genuinely a SET — a competition may accept individual entry *and* school
entry. The single-value column forced composite tokens (`SCHOOL_OR_CHAPTER`) and a wildcard
(`EITHER`, renamed `OPEN` by `0016`), i.e. the classic "enum that should be a set". A set expresses
`{SCHOOL, CHAPTER}` exactly, and **all three composite tokens disappear**: `SCHOOL_OR_CHAPTER`,
`OPEN`, `EITHER`. "Open to all" becomes all three selected.

**Precedent to mirror exactly — do not invent a new pattern:** `evaluation_type` is already a
multi-valued facet: `TEXT[]` column (`0002`), GIN index (`0007`), `&&` overlap in
`CompetitionSearchService`, `@JdbcTypeCode(SqlTypes.ARRAY) List<String>` on the entity, checkbox
group in the admin form, token validation at the service boundary.

**As built.** Executed exactly as planned below, with two notes worth carrying:
`EntryPathway` (the enum) was **retired in favour of a token set**, `EntryPathways`, mirroring
`EvaluationTypes` — the alternative the plan offered, chosen because the composites were the only
reason an enum bought anything. And tokens stay **UPPERCASE** in storage (the backfill inherited
the old enum column's casing rather than rewriting every row for cosmetics), so the public DTOs
lowercase them on the way out, as they already did for every other enum. The old `entry_pathway`
column is dormant and unmapped; the singular key is still READ from queued import payloads
(`import-seed.ts`), which is why the ~46 PENDING records needed no data migration.

**Migration (as executed, additive-only):**
1. `addColumn competition.entry_pathways TEXT[]`.
2. Backfill from `entry_pathway`: `INDIVIDUAL→{INDIVIDUAL}` · `SCHOOL→{SCHOOL}` ·
   `CHAPTER→{CHAPTER}` · `SCHOOL_OR_CHAPTER→{SCHOOL,CHAPTER}` · `OPEN`/`EITHER`→
   `{INDIVIDUAL,SCHOOL,CHAPTER}`.
3. `CREATE INDEX ... USING gin (entry_pathways)` — it is a filter facet, so the index is required,
   not optional.
4. `dropNotNullConstraint` on the old `entry_pathway` column, then leave it **dormant and unmapped**
   — same treatment as retired `competition.summary` (§8 note); precedent for relaxing NOT NULL is
   `0008` (`key_date.starts_at`). Do NOT drop the column.

**Code to change:**
- `EntryPathway.java` — reduce to `INDIVIDUAL, SCHOOL, CHAPTER` (or retire the enum in favour of
  token validation, mirroring `EvaluationTypes`).
- `Competition.java` — unmap `entryPathway`, add `entryPathways` as an ARRAY column.
- `CompetitionRequest` · `CompetitionAdminController.CompetitionResponse` · **public**
  `CatalogPublicController.CompetitionSummary` **and** `CompetitionDetail`: `entryPathway` →
  `entryPathways` (a **public API contract change** — web is the only consumer and ships in the
  same build-once-promote image, so no versioning needed, but deploy them together).
- `CompetitionSearchService` — delete the `pathwayMatches()` match-set helper added 2026-08-23; a
  single-select filter becomes `entry_pathways && ARRAY[:pathway]`. The whole broader-token
  problem evaporates.
- Web: `admin-types.ts` (`ENTRY_PATHWAYS` = 3 tokens) · competition form (Select → Checkbox group,
  copy the `evaluationType` block verbatim) · `competition-payload.ts` (`multi()` not `str()`) ·
  `detail-display.ts` (`pathwayLabel` → join a list; drop the legacy keys) · `key-facts.tsx`
  Eligibility row · `filter-panel.tsx` (keep single-select radio: a user filters by the ONE route
  they would use).
- **Seeding pipeline** (`tools/seeding`): `types.ts`, `prompt.ts`, `validate.ts`, `extract.ts` emit
  `entryPathways` as an array.
- **Queued import payloads**: ~46 PENDING records carry singular `entryPathway`. Map it in
  `lib/import-seed.ts` (read either shape) rather than rewriting the stored payloads — same
  approach as the retired-`summary` handling; a data migration is optional, not required.
- Tests: API integration tests post `"entryPathway": "…"` in several JSON bodies;
  `import-seed.test.ts` fixtures.

**Verification checklist:** filter each of the 3 tokens against seeded rows and confirm a
`{SCHOOL,CHAPTER}` listing appears under BOTH school and chapter · admin form round-trips a
2-value selection · detail page Eligibility shows both labels · an import approve preserves the
extracted pathway(s).

---

## 8. R1-1 as-built notes (2026-07-12 — migrations `0002`/`0003`, `apps/api` catalog module)

The R1-1 catalog schema shipped (12 tables: the §5 catalog set + `CompetitionFaq`,
`CorrectionProposal`, `HeroCard`, `FeaturedSlot`). Build-time decisions, now house rules:
- **UUID PKs** with DB default `gen_random_uuid()` (PG13+ core) — seed SQL needn't supply ids.
- **Enums = `varchar` + Java enum (`@Enumerated(STRING)`, UPPERCASE in the DB); no DB CHECK
  constraints** — adding an allowed value later stays purely additive. Public lowercase token
  form is a DTO-layer concern (R1-4).
- **Provenance = three typed columns** (`provenance_source`, `provenance_last_verified_at`,
  `provenance_confidence`) + separate `verification_state` — not a JSONB blob (D1: we filter on
  these).
- **Multi-valued facets** (`tags`, `evaluation_type`) = Postgres `text[]` (GIN-indexed since
  R1-5 migration `0007`), not child tables. JSONB (`@JdbcTypeCode(SqlTypes.JSON)`) for
  `attributes`/`json_schema`/`ui_hints`/`affiliate_meta`/correction `payload`.
  **`evaluation_type` tokens are canonical since R1-5** (`EvaluationTypes`: `submission, exam,
  live_performance, interview, portfolio`) — stored in lowercase public-token form and validated
  at the curation write boundary; adding a token is additive.
- **R2 references stay FK-less**: `organizer_org_id`, `submitted_by_user_id`, `reviewed_by`,
  `updated_by` are nullable UUIDs; the FKs are added in R2-1 with their target tables.
- **Hibernate runs `ddl-auto: validate`** against the Liquibase-migrated schema on every boot;
  `@CreationTimestamp`/`@UpdateTimestamp` populate audit columns in memory at write (DB `now()`
  defaults remain as a net for raw seed SQL).
- **Deliberate non-constraints:** no unique on `edition (competition_id, cycle_label)` (Q3 —
  operationally distinct regional runnings share a cycle label); archived records keep their
  slug (D7 SEO); `featured_slot.position` not unique (reorder ergonomics — R1-3 enforces).

**Foundation-final additions (owner-approved 2026-07-12, migration `0004`):**
- **`Organization` built in R1-1** (see §3b note) + real FK on `competition.organizer_org_id`.
- **`competition.summary`** — ~~curated 1–2 sentence card blurb (clamp-2)~~ **RETIRED 2026-08-21**
  (owner decision): curators write only `description`, and the CompetitionCard's two-line blurb is
  derived from it — the public search projection sends `blurb`, a word-boundary truncation to 300
  chars done server-side in `CatalogPublicController.cardBlurb` (a description runs to 10 000 chars
  and a search page carries 24 of them). The **column still exists** and is deliberately unmapped:
  migrations are additive-only, and it is still an argument to `0007`'s generated search tsvector.
  Dropping it would require rebuilding that generated column + its GIN index in the same migration.
- **`updated_at`** on all curated content tables (competition, edition, resource, competition_faq,
  category, category_template, organization): sitemap lastmod (R1-10), S5 freshness, audit-lite
  until `ActivityEvent` lands (R2-9).
- **Optimistic locking (`version` + `@Version`)** on curated tables — concurrent admin edits (R1-3)
  conflict loudly instead of last-write-wins.
- **Region natural key:** unique `(parent_id, level, name)` NULLS NOT DISTINCT — dedup guard for
  seeded geo.
- **Effective-status rule (binding for R1-4/R1-5):** `edition.status` is curated and CAN drift from
  the `key_date` timeline. Read paths must compute *effective status* = f(status, key_dates, now())
  — e.g. a listing whose `reg_close` has passed renders closed even if `status` still says open —
  and S5's stale-date report flags status↔dates mismatches for curator correction.
  **Implemented (R1-4, 2026-07-12)** in `catalog.service.EffectiveStatus`, exposed as
  `effectiveStatus` on public edition DTOs. v0 rules: curated CLOSED/ONGOING/ARCHIVED stand;
  UPCOMING/OPEN whose deadline (earliest `REG_CLOSE`, fallback earliest `SUBMISSION_DUE`) has
  passed → closed; UPCOMING whose `REG_OPEN` has passed (deadline ahead) → open.
  **Write side (2026-08-22):** the admin CREATE form no longer asks for a status —
  `EditionRequest.status` is nullable; null on create seeds the stored value from the same
  EffectiveStatus rules over the submitted key dates (UPCOMING when there are none), null on
  update keeps the current value. The per-edition edit page keeps the status select as the
  curated override for the states dates can't know: CLOSED early (cap reached), ONGOING,
  ARCHIVED. An import-approve with an extracted `status` still stores it as sent.

**Sweep-remediation as-built (2026-07-13 — migrations `0008`/`0009`; remaining backlog in
`sweep-remediation-plan.md`):**
- **TBD key dates (R1-18, `0008`):** `key_date.starts_at` dropped NOT NULL — NULL means "this
  milestone exists, its date is TBD", uniform across **all** key-date types (owner). Rules:
  `ends_at` requires `starts_at` and must be after it (`@AssertTrue`); effective-status
  computation filters null dates (a TBD `REG_CLOSE` never closes a listing); search's
  next-deadline lateral excludes NULLs by SQL semantics and the deadline sort is `NULLS LAST`;
  UI renders "TBD" / "Deadline · TBD" sorted last, with no add-to-calendar links; JSON-LD Event
  omits TBD dates. A card-level "Date TBD" label is deferred (needs a `deadline_tbd` search
  projection — see the backlog, R2).
- **Key-date timezone semantics (bug fix):** `starts_at`/`ends_at` are instants; the `timezone`
  column (IANA, admin-picked from a dropdown, default `America/New_York`) is the authoritative
  wall-clock zone. Admin wall-clock input is converted server-zone-independently via web
  `lib/dates.ts zonedWallClockToInstant` (two-pass Intl offset probe, DST-safe) and rendered
  back via `formatInZone` in the stored zone — never `toLocaleString()` / server-local.
- **Org trust ladder (R1-19, `0009`):** see §3f — trust is org-only (`CURATED → CLAIMED →
  VERIFIED`; `UNVERIFIED` retired, existing rows folded to `CURATED`); competition/edition
  `verification_state` is vestigial, held at the constant `CURATED`, never read.
- **Validation bounds (server = source of truth; forms mirror):** grades `-1..17`
  (13–16 = the four college years, 17 = Graduate — the reserved post-HS headroom, accepted since
  2026-08-23 and split into named years 2026-08-24);
  ages `0..25`; team sizes `≥ 1`; cross-field `min ≤ max` on grades/ages/team sizes;
  `entry_fee`/`prize_value` `≥ 0` with ≤ 2 decimals, each requiring its 3-letter uppercase
  ISO-4217 currency; key-date `ends_at > starts_at`. Bean-validation failures return **400**
  with the rule's message echoed (Spring default; `ApiExceptionHandler` surfaces it).
- **Deliberate non-constraints (completeness ≠ validity):** NO hard rule tying team-size fields
  to `participation_mode` (imports carry sloppy data — owner; the UI disables the inputs
  instead), and `organizer_org_id` + deadlines are never required (imports start unattributed;
  dates live on Edition key dates, D3). Completeness is surfaced by the admin **listing-health
  checklist** instead (web `lib/listing-health.ts` — derived, informational, never blocks
  saves. The explicit draft/publish gate anticipated here is now specced — see **§8a · Listing
  lifecycle & approval** below).

## 8a. Listing lifecycle & approval *(owner-approved 2026-07-14; R1 foundation, additive)*

Untangles four **independent axes** that were previously collapsed into `archived_at` alone. The
public read composes them; each is set/queried on its own. (3-era rationale diagram archived with
the design discussion.)

| Axis | Column(s) | R1 behavior |
|---|---|---|
| **Approval** — vetted? | `approved_at`, `approved_by` | Auto-stamped on admin create (admin = trusted). The DQ12 pre-publication review outcome for self-submissions (Phase 3). |
| **Listing status** — lifecycle | `listing_status` | `DRAFT → PUBLISHED ⇄ UNLISTED`; `ARCHIVED` via `archived_at`. |
| **Visibility** — audience | `visibility` | **Not in R1** (curated = public by definition). H48, Phase 3: `public / link-only / invite-only`. |
| **Run status** — per running | `edition.status` + `EffectiveStatus` | Already built (§8 effective-status rule). |

**State machine (`listing_status`):** `DRAFT (optional) → [IN_REVIEW]* → PUBLISHED ⇄ UNLISTED`, and
`→ ARCHIVED` from any state (via `archived_at`).
- **DRAFT** — optional save-and-resume; **not** a mandatory gate (admins may publish directly).
- **IN_REVIEW\*** — entered only when an *unverified* host publishes (DQ12); admin/curated skip it. **Phase 3.**
- **PUBLISHED** — approved + live + **auto-listed** publicly. `approved_at` stamped on first entry.
- **UNLISTED** — a published listing temporarily pulled from public view; reversible (**re-list**). The "pause."
- **ARCHIVED** — retired (`archived_at`). **Archiving auto-unlists** — an archived listing is never public.

**Public-visibility gate (binding for read paths):**
`archived_at IS NULL AND listing_status = 'PUBLISHED' AND EXISTS(non-archived edition)` — the
`EXISTS(edition)` clause is the **readiness gate** that ends "zombie" listings (live with no
edition/deadline). Phase 3 appends: `AND approved AND visibility = 'public' AND (list_at IS NULL OR
now() >= list_at)`.

**As-built (2026-07-15, no schema):** the `EXISTS(non-archived edition)` clause is now enforced on
every public read — browse/search/count + grade & category facet counts (`CompetitionSearchService`),
detail (404 when none), sitemap, category tile counts, landing featured + the live-catalog count
(`countPublicListings`). The source-side fix — combined create-competition-with-first-edition
(`POST /admin/competitions/with-edition`, `ListingCurationService`, one transaction) — makes
admin-created listings complete-by-default.

**As-built (2026-08-25 — item 14 landed, migration `0021`):** `listing_status varchar(20) NOT NULL
DEFAULT 'PUBLISHED'` (enum `DRAFT|IN_REVIEW|PUBLISHED|UNLISTED` — IN_REVIEW included NOW as the
curator submit-for-review state; DQ12 reuses it at Phase 3), `approved_at timestamptz NULL`,
`approved_by uuid NULL` (FK-less; stays NULL until RBAC R2-7 — WHO published is in the admin write
log). Backfilled `approved_at = created_at`. The public gate now enforces all three legs
(`archived_at IS NULL AND listing_status='PUBLISHED' AND EXISTS(edition)`) on every surface above,
plus detail-by-slug (a draft with a guessable slug 404s). Combined create takes an optional
`listingStatus` (null → PUBLISHED, so import-approve and scripts stay one-step; publish stamps
`approved_at` once, never re-stamped on re-list). Transitions via
`PUT /admin/competitions/{id}/listing-status`, validated (`ListingStatus.canTransitionTo`):
`DRAFT → IN_REVIEW|PUBLISHED`, `IN_REVIEW → PUBLISHED|DRAFT`, `PUBLISHED ⇄ UNLISTED`; archived
listings must be restored first. **The unified review queue** (`/admin/review`, owner-requested
2026-08-25) is one page for both decision streams: IN_REVIEW listings (publish/send-back inline)
and PENDING import records (deep review stays on the import screen). Create form offers
Publish now / Submit for review / Save as draft — same completeness gate for all three; with no
roles yet, review is process + audit trail, not permission.

**Deferred seams — design now, build later:**
- **IN_REVIEW + DQ12** pre-publication review (Phase 3): `approved` becomes the review outcome, and an
  **edit keeps the current version public** while the edited version is re-reviewed (never dark a live
  listing for a typo).
- **`visibility`** (H48, Phase 3), renamed **link-only / invite-only** (glossary 2026-07-14) so
  *unlisted* is only the lifecycle toggle; `public` gated by host verification + `public_listing`.
- **`list_at`** scheduled listing (R2+): publish now, auto-list at a future instant.
- **Per-level / per-round** variation (deadlines/costs/delivery): the target **Edition → Stage →
  Round** model (§8b) puts these on the **Stage**; R1's single running carries one date/fee set +
  competition-level `delivery`, so per-tier variation waits for Phase 3 (registry **H24/H25**).

The participant **Journey** (X23: saved→…→result) is a separate axis and **never** gates listing
visibility.

## 8b. Competition structure: Edition → Stage → Round *(Phase-3 target model, owner-approved 2026-07-14)*

Records the target hierarchy that supersedes Q3's interim "regional runnings = separate Editions"
framing. **R1 keeps the simple form** (below); the split builds at Phase 3 with multi-level
advancement (HC5 / registry H24–H25), designed at Gate A — not hardened early.

**Three tiers — one per structural axis** (the old `Edition` conflated the first two):

- **Edition** = the *annual cycle* ("2026") — **one per year**. Owns default/representative info
  (typical cost, deadline window, description) + the structure summary.
- **Stage** = a *level-instance* a participant registers for ("Texas Regional", "National
  Tournament"). Owns real dates, cost, registration URL, `scope_level`, and region(s)
  (`StageRegion`); linked upward by `advances_to`. Category display label: Tournament / Fair / Event.
- **Round** = a *sequential phase within a Stage* (written → oral). Optional.

**Worked example — Science Bowl 2026 (10 regionals → national):** 1 Competition → **1 Edition (2026)**
→ **11 Stages** (10 `scope=REGIONAL` + `StageRegion`, each `advances_to` → 1 `scope=NATIONAL`) →
Rounds within a Stage if any. **One listing; many Stages active in parallel** — no longer "many
editions at once." Next year = a new Edition with its own Stages (Stages share no uniqueness across
years — the Q3 non-unique-cycle rule moves to Stage).

**Rename map from the R1 schema (additive/rename evolution, Phase 3):**
- today's `Edition` (a per-place running) → **Stage**; `advances_to_edition_id` → `advances_to_stage_id`;
  `EditionRegion` → `StageRegion`; `scope_level` + key dates + fees + prize move to **Stage**.
- a new **Edition** (annual cycle) grouping is added *above* Stage, holding the defaults.
- the `Round` glossary synonym "a.k.a. Stage" is dropped — Round = phase only.

**R1 interim (what we build now):** one running = one `Edition` record (today's schema). A
multi-regional competition is captured with the Edition's **default info + prose + a link to the
host's official "find your regional" page** — we do **not** hand-model 11 records at R1. Discovery
stays one listing; per-region deadlines/costs, the **"select your region" Stage selector**, and the
advancement graph are Phase 2/3.

**Display defaults + region selector:** the listing shows the Edition's representative cost/deadline
with a disclaimer ("varies by regional — select your region for specifics"); selecting a region swaps
in that Stage's exact values. Ties to the headline/current-edition pick + `current_edition_id` (§8a).

**Host manageability:** a local regional host manages **their Stage** (registration, roster, dates,
fee); the program owner manages the **Edition** (all Stages + the advancement chain). A **federated**
program (different org per regional, ISEF-style) gives each Stage its own owning org — separation
without fragmenting discovery into many listings. (A grouping *above* Competition — a Program/Series
entity — is a separate future consideration, only if we onboard federated networks.)


**Owner decisions 2026-08-22 — structure model confirmed + host-tools design intent.** A full
pass over alternatives ended with the §8b model REAFFIRMED; the following is binding direction
for the Phase-3 deep-dives (Gate A/B still design the judging/advancement internals):

- **Alternatives rejected, with reasons (do not reopen without new facts):**
  (a) *Drop Edition; hosts duplicate the Competition yearly* — rejected: breaks the evergreen
  slug/SEO asset (N near-identical listings, zero carried page authority), turns cross-year
  continuity (follows, tracker, results history M33, analytics) into an annual migration chore,
  and multiplies content upkeep (a description fix must land in N copies). The pain it targets
  ("rebuild from scratch each year") does not exist: everything reusable — description, cover,
  resources, practice sets, FAQs — lives on the evergreen Competition and never moves at rollover.
  *(⚠ That last clause is superseded by §8c (2026-09-01): yearly content now lives on the Season
  and rollover COPIES it forward. The rejection itself stands — it was about duplicating
  *listings*, and there is still exactly one listing/slug per competition.)*
  (b) *Scope carried on timeline events (KeyDates)* — rejected: a timeline is *sequence* (when);
  scopes within a season are *parallel instances* (where). Ten regionals are ten simultaneous
  instances of ONE phase, each with its own registration/fee/results/owner — a scope tag on a
  KeyDate cannot carry those, and growing it until it can just reinvents Stage in a shape that
  cannot express 10-feed-1. The timeline *renders* stages as phases (presentation), storage keeps
  the two axes separate.
  **"Edition" disappears from the UX, not from storage:** hosts meet "seasons", never the word
  Edition (status already derives, 2026-08-22; cycle label can default).
- **Season rollover ("Open next season"):** one click clones the prior Edition's *structure* —
  level/Stage skeleton, timeline with dates cleared to TBD, fee defaults — under the same
  Competition. Separate host feature **"Duplicate competition"** exists for genuinely new sibling
  programs (new identity, new slug); duplication is never the yearly mechanism.
- **Levels vs. instances; instances are template clones.** A host defines each *level* once
  (Regional / State / National — rubric + judging info, awards, advancement rule live PER LEVEL);
  *instances* (the per-place Stages: Dallas, NY…) clone the level template and edit only deltas
  (venue, date-in-window, local reg URL, local fee if allowed). Ten regionals = one level + ten
  table rows with a duplicate-row gesture. Assigning an instance's owning org hands that org
  management of exactly that Stage (federated model, above).
- **Field governance — every field is locked / defaulted / local:** *locked* = set by the program
  owner, inherited, immutable below (brand, description, resources, eligibility, level structure,
  advancement rules, rubric per level); *defaulted* = owner sets, locals may override where policy
  allows (fee, registration settings, award text at their level); *local* = instance-owner only
  (venue, exact date, local reg URL, roster, judges). The owner sets **windows, not dates**
  ("all regionals complete by Mar 15"); locals pick dates inside the window.
- **Slot/invite coordination:** the owner publishes the season skeleton with expected coverage as
  *slots* (TX, NY, … or open). Granting a coordinator role (Membership/Role, X5 → R2-7) fires the
  invite — a dashboard task card + an empty node on the season map; the coordinator's instance
  arrives pre-filled from the level template; publishing turns the node live. The owner gets a
  **coverage dashboard** (live / pending / nudge).
- **Real-time progression:** when an instance posts results, its advancement rule fires and
  qualifiers appear on the next level's roster automatically ("12 qualifiers arrived from
  Dallas") — no manual handoff. (Rule *enforcement* = H25/HC5, designed at Gate A/B.)
- **Architecture map (visual):** the season tree/DAG rendered as a diagram with status coloring —
  host view shows slots, coverage, and per-node ownership; a simplified participant view shows
  "you are here → next: State, Apr 2" on the listing.
- **Per-level awards + judging display:** at Phase 3 the judging catalog info
  (`judging_criteria`/`tie_breakers`/`rules_url`, today competition-level) and the prize fields
  (today edition-level) move DOWN to Stage; the public Awards tab renders a per-level breakdown
  ("Regionals — medals · State — advancement only · National — $10,000 scholarship", → H47) and
  the Judging tab shows the rubric per round. **R1 interim:** the single free-text
  `prize_summary` states multi-level prizes in prose ("Medals at regionals; $10,000 at
  nationals"). A final Stage can be **entry-by-advancement** (non-registrable): no Register
  button; the listing says "qualify via your state round". Participants register ONCE per season
  at their entry Stage (the region selector picks the instance); advancement promotes them with
  no re-registration; the tracker shows one continuous journey.
- **Structure-first create form:** the add-competition form OPENS by asking the competition's
  structure — (a) *multi-level tiers* (regional/state/national …), (b) *one location, multiple
  rounds*, (c) *single event, no rounds* — and the chosen answer shapes the rest of the UI:
  (c) keeps today's single-running wizard (a lone Stage is implied; the word never appears),
  (a)/(b) add a Structure step (levels list → per-level sections reusing the standard
  Overview/Eligibility/Judging/Awards/Timeline panels → instances as a duplicate-friendly table),
  navigated by the existing stepper rail grown into the season tree. Returning hosts land on
  "Open next season" or a template (single event / multi-round / multi-region) instead of a blank
  form. **Admins curating external competitions keep the single-running form** (the R1 interim
  rule stands — we don't hand-model someone else's regionals).

- **School-restricted entry = ELIGIBILITY; listing visibility is a separate lever (owner
  2026-08-23).** Competitions restricted to students of specific schools/universities — whether
  *interschool* (a five-school math league) or *intraschool* (owner clarification: even
  single-institution events are sometimes restricted to a set of universities) — are modeled as
  an **enrollment restriction**: a structured "must be enrolled at one of: […]" list referencing
  `Organization(type=school)` rows, enforced at registration by the **H36 eligibility pre-screen**.
  Phase 3, alongside the JSONB→Spine promotion (sweep §16): enforcement needs verified school
  affiliation on `ParticipantProfile`, which is COPPA-sensitive and belongs in that deep-dive —
  no free-text stand-in field before then. ⚠ `student_status_required` is **not** that stand-in
  and no longer can be: it became a plain boolean at `0022` (owner 2026-08-26), so it records only
  *whether* enrolment is required, never *where*. A listing that needs to state the restriction in
  words uses `other_eligibility_requirements`, display-only, with no enforcement implied. **Visibility** (public / unlisted / private listings) is a
  *separate* Phase-3 host-tools item: it answers *who can find it*, never *who may register*, and
  the two compose — an interschool league lists publicly WITH an enrollment restriction so its
  schools' students discover it; a school-internal event may be unlisted AND restricted. Do not
  conflate the levers: restricting visibility is never the mechanism for restricting entry.

Cross-ref: Q3 (region granularity) · §8a (lifecycle) · registry H24 (stages/rounds) / HC5
(advancement) · H36 (eligibility pre-screen) · glossary (Edition / Stage / Round / Advancement).

## 8c. Season owns the listing content *(owner decision 2026-09-01 — field re-allocation)*

**The change in one sentence:** the Competition keeps only *permanent identity*; **everything a
visitor reads about a given year lives on the Season** (storage name: today's `Edition`), and a
new season starts as a copy of the last one.

**Why the evergreen/seasonal binary failed.** Most catalog fields are "stable until they aren't":
team size, delivery mode, eligibility bands, judging info, rules URLs — and FAQ/Resources in
practice ("When is registration?" has a new answer every year; half of real resources are
year-stamped guides). The old model's answer — edit the Competition in place — (1) silently
falsifies past seasons the moment results history (M33) and tracker pages make them worth
revisiting, (2) lets an edit mutate what an already-open season displays, and (3) forces the admin
UI to scatter one concept across two owners by a rule nobody can remember (the R1 form's
`hideOnEdit` / `edition_`-prefix seam — fee inline on create, a separate page on edit).
Cross-level smells were already in the code: `cost_type` (competition) validated against
`entry_fee` (edition); `age_cutoff_date` (edition) split from the grade/age bands (competition);
`rules_url` competition-level though rules PDFs are year-stamped.

**What is NOT reopened.** D2's two-level split stands — never merge the tables. §8b's
Edition → Stage → Round target stands untouched, Gate A/B included. ONE competition = one
slug / listing / page: the 2026-08-22 rejection of yearly *listing duplication* targeted
SEO/continuity fragmentation across many listings, which per-season snapshots under one listing do
not cause. Admins still model a single running for external competitions. **"Season" is the UX
word everywhere; `Edition` stays the storage/entity name** (glossary updated 2026-09-01).

**Field allocation** *(supersedes D2's wording "identity/resources/reputation" — allocation only,
not the split)*:

- **Competition — permanent identity only:** name, slug, category, organizer org, logo/cover,
  tags, recurrence, `official_url` (the program's homepage), listing lifecycle (§8a), provenance.
  Plus **mirror columns**: `summary`/`description` are kept as *write-through copies of the
  current season* because the generated `search_vector` (migration `0007`) and card projections
  read them — mirrors are cache, never the source of truth.
- **Season (`Edition`) — everything else:** summary, description, delivery, participation mode,
  team size min/max, entry pathways, ALL eligibility (basis, grade/age bands, `age_cutoff_date`,
  the JSONB eligibility keys), evaluation type + judging display info (`judging_criteria` /
  `tie_breakers` / `rules_url` — until they drop to Stage at Phase 3 per §8b), `cost_type` + fees,
  awards/prize, registration URL, timeline (`KeyDate`), regions, scope, **FAQ entries and
  Resources**, and the category-template `attributes` bag (templates validate the *season's* bag).
- Reserved entities keep their sketched homes and are re-tiered at their own build time
  (e.g. Division stays per-Competition per Q4 until its build revisits it).

**Current-season pointer.** `competition.current_edition_id`, resolved **server-side** with the
same precedence the web's `currentEdition()` uses today (open → ongoing → upcoming → latest-dated),
maintained on edition/key-date writes and status changes. Public payloads serve the current
season's values pre-merged, so the web never learns about mirrors. This also fixes the live
inconsistency where the card deadline scans all editions while the page renders one.

**Rollover.** "Open next season" (already §8b) copies the prior season's FULL content — prose,
eligibility, format, fees, FAQ, resources, timeline skeleton with dates → TBD — then the
curator/host edits what changed; the copy step doubles as the yearly "is this still true?" review.
Only the current season is normally edited; past seasons freeze as accurate history (feeds M33 and
the "seasons over time" display, `sweep-remediation-plan.md` §12a). "Duplicate competition"
remains the separate new-program gesture, never the yearly mechanism.

**Admin/host UI direction — one workspace.** One page per competition: an identity block on top
("applies to all seasons") and **season tabs** (`2025 · 2026 · + Open next season`) scoping
everything below, every field in one fixed place. Create, edit, and import review all render this
same page; the create/edit field-location split and the import empty-cycle-label trap (approve
with no running → published-but-invisible) are retired by construction. Hosts later get the same
workspace plus the §8b structure-first step; the org-axis locked/defaulted/local governance chips
render in the same visual language (grey = inherited, editable = yours).

**Build plan:** R2-sized; task scoping lives in `sweep-remediation-plan.md` §19. Migrations stay
additive-only: new `edition` columns + a backfill that copies competition values onto existing
non-archived editions — identical by construction, so each read-path cutover returns the same data
and deploys as a visible no-op until the workspace UI ships.

Cross-ref: D2 (split stands, allocation revised) · §8a (lifecycle + readiness gate unchanged) ·
§8b (Stage target unchanged) · glossary (**Season**) · `sweep-remediation-plan.md` §19 (tasks),
§12a (past-season display rides this) · §16 there (JSONB→Spine promotion now lands on `edition`).
