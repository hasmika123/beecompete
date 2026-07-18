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

**D3 — Timeline as data, not columns.** An Edition's dates are rows in `KeyDate` (typed events),
not fixed columns — so any timeline shape works.

**D4 — Generic parties & payments.** `User`, `Organization`, `Entitlement` are generic so that
host/school/sponsor and payer≠beneficiary all fall out without special cases (keeps "free for
schools" and "sponsorship" as later config, not migrations).

**D5 — Derive progress from an Event Log.** No bespoke progress columns anywhere. All progress
(participant, cohort, parent views) is aggregated from one append-only `ActivityEvent` stream.

**D6 — Structure is entities, not flags.** Divisions, Rounds, and Advancement are first-class
records because K-12 competitions are multi-division, multi-round, and multi-level.

**D7 — Soft-delete + event-log audit; no temporal tables** *(locked 2026-07-07)*. Curated records
are **never hard-deleted** (their slugs carry SEO and inbound links): archive via `archived_at` /
status instead. Field-level change history = `ActivityEvent` rows (verb `updated`, payload = diff) —
no separate versioning/history tables. User-submitted corrections (DQ6) are rows in a
**`CorrectionProposal`** queue that curators approve; the main tables are never versioned.

---

## 2. The six open questions — resolved

| # | Question | Decision |
|---|---|---|
| Q1 | **Category set** for launch | A two-level taxonomy (Category → Subcategory), seeded with ~10 top K-12 categories: Math · Science & Engineering · Computer Science/Coding · Robotics · Debate & Speech · Business/Entrepreneurship (CTSO) · Writing & Essay · Arts & Music · Academic Bowl/Quiz · History/Geography/Civics · (+ "Other"). This is **seed config, not schema** — the taxonomy table grows freely. |
| Q2 | **Grade/age** representation | Store **both**: a normalized **grade range** (`min_grade`/`max_grade`) as the *primary* eligibility/filter axis, and an optional **age range** (`min_age`/`max_age`) for age-gated or international competitions. A Participant has a grade + DOB (→ age). **Encoding locked (2026-07-07):** `smallint` — **Pre-K = −1, K = 0, grades 1–12 = 1–12; 13 = post-high-school (reserved, unused at launch — keeps collegiate expansion migration-free)**. Homeschool/ungraded map to the age-equivalent grade. Age-gated comps filter on age (from DOB); grade-gated on grade. **Profile storage (locked 2026-07-07):** participants store **`grad_year`** as canonical; grade is *derived* (UI asks grade, converts on save) — so profiles never go stale at school-year rollover. |
| Q3 | **Region** granularity | Structured geo, not free text: **Country → State → County/District → City**, plus a special **"Virtual/Online"**. Each Edition has a `scope_level` (national/state/regional/local/virtual) + associated region(s). US-first ⇒ **State** is the primary filter granularity; District enables chapter scoping. **Multi-region rule locked (2026-07-07):** the region join is **Edition-level** (`EditionRegion`). Test: **one registration = one Edition** — same dates + same registration + same results ⇒ **one** Edition tagged with many regions (e.g., AMC 10 2026 nationwide); operationally distinct regional runnings (own dates/registration/results) ⇒ **separate** Editions (e.g., Dallas vs. Houston regional fairs), linked upward via `advances_to_edition_id` — exactly the advancement chain. A Competition's region facet in search is *derived* from its Editions. **Phase-3 target (§8b):** these per-place runnings are renamed **Stages** under a single annual Edition (not separate Editions); R1 keeps this interim separate-record form. |
| Q4 | **Division** representation | A generic `Division` per Competition with a name + flexible criteria (grade range and/or skill label). Not hard-coded — each Competition defines its own (Junior/Senior, Novice/Varsity, etc.). A participant maps to a Division at registration. **Placement locked (2026-07-07): `Division` lives on `Competition`** (stable identity across years — needed for history/analytics) with an **`active` flag**; restructures add new rows + deactivate old ones, never edit existing rows. `Registration` **snapshots the resolved division** at registration time, so later definition changes never rewrite past records. No per-Edition division copies. |
| Q5 | **Round / advancement** | Two mechanisms: **`Round`** = a sequential phase *within* an Edition; **Edition linkage** (`advances_to_edition_id`) = multi-level advancement *across* Editions (school→regional→state→national). `AdvancementRule` (top-N / threshold / judge-selected) attaches to a Round or linkage. Structure is represented at launch; *enforcement* lands with the Phase-3 host tools (H25/HC5 — moved 4→3 by registry Rev 5; designed at Gates A/B). Rules are data, not code. |
| Q6 | **Team composition** | A `Team` is Edition-scoped (name, division) with `TeamMember` rows. A `Registration` is polymorphic — registrant is **either** a Participant **or** a Team. Teams form via a Group (coordinator) or self-organize (team-finder). Size bounds come from the Competition's Format. |

---

## 3. Entity catalog

### 3a. Competition domain

**`Competition`** [P1] — the evergreen entity.
`id, slug, name, organizer_org_id?, official_url, logo, description, summary?, category_id, tags[],
participation_mode (individual|team|both), team_size_min?, team_size_max?, delivery
(in_person|virtual|hybrid), entry_pathway (individual|school_or_chapter|either), evaluation_type[],
min_grade?, max_grade?, min_age?, max_age?, cost_type (free|paid), recurrence
(annual|one_off|rolling), attributes (JSONB), provenance{...}, verification_state, archived_at?,
created_at` *(soft-delete per D7)*
*(`entry_pathway` added 2026-07-08, legacy review: whether a student can enter independently or
only through a school/chapter — filterable, shown in the Details at-a-glance strip.)*

> **Standard attributes-bag keys** *(2026-07-08 — conventional JSONB keys, not Spine columns;
> validated per Category Template where relevant):* `eligible_countries[]`,
> `citizenship_countries[]`, `student_status_required` (international/eligibility depth) and
> `syllabus` / `topics[]` (feeds Participant+ practice content + recommender, → P8).

**`Edition`** [P1] — one running of a Competition.
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

**`Region`** [P1] — `id, parent_id?, level (country|state|county|city|virtual), name, code`
*(`virtual` level added at R1-1 build, 2026-07-12 — the Q3 special "Virtual/Online" region needs a
level so virtual Editions can carry a region row. **Seeded** at sweep item 15, 2026-07-16, Liquibase
`0010`: US + 50 states + DC + ~25 major cities + `Virtual / Online` — so admins pick, not
hand-create; more (Canada, counties) via admin CRUD. The grouped/searchable admin picker is
`region-picker.tsx`.)*
**`EditionRegion`** [P1] — join: which regions an **Edition** covers *(locked 2026-07-07; renamed from `CompetitionRegion` — the join is Edition-level, never Competition-level)*. One registration = one Edition (Q3); the Competition's region filter is derived from its Editions.

**`Resource`** [P1] — curated prep/reference link on a Competition.
`id, competition_id, title, url, type (book|past_paper|guide|video|other), is_affiliate, affiliate_meta (JSONB), display_order, created_at`
*(`display_order` added at R1-1 build — the details Resources row is a curated, ordered strip.)*

**`CompetitionFaq`** [P1] — curated per-competition FAQ entry (glossary: **FAQ Entry**; details
FAQ tab + FAQPage structured data → R1-7; shape decided at R1-1 build, 2026-07-12).
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
> `organizerName` by an **exact (normalized, case-insensitive) name match → reuse**, and creates a
> fresh org when there is no match. Auto-created orgs are **`CURATED`/`HOST`** (unclaimed, no R1
> verification work) with `domain` inferred from the official URL and the competition's provenance
> stamp. Conservative by decision: a name that only matches **similar** (containing) orgs is
> **refused (422, listing candidates)** unless the curator sets `confirmNewOrganizer` — no
> fuzzy/acronym matching, no auto-merge (a wrong merge is worse than a duplicate). An exact match
> that is **archived** is a 422 (restore or pick another). A row with **no organizer** is flagged
> for manual assignment (the seeding pipeline sends `organizerName: null`, never a placeholder). No
> unique index on `organization.name` — R2 will legitimately hold same-named schools; the
> single-curator R1 accepts the create race. Lets the S4 seeding pipeline attribute 200+ imports
> by name without pre-creating orgs by hand.

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
- ✅ **Grade encoding** → Q2: `smallint`; Pre-K = −1, K = 0, grades 1–12 = 1–12; 13 reserved for post-high-school.
- ✅ **Division placement** → Q4: on `Competition`, `active` flag, snapshot at registration.
- ✅ **Soft-delete / versioning** → D7: soft-delete (`archived_at`) + `ActivityEvent` diffs + `CorrectionProposal` queue; no temporal/history tables.

- ✅ **Multi-region Editions** → Q3: region join is **Edition-level** (`EditionRegion`); rule = *one registration = one Edition* — same dates/registration/results ⇒ one Edition, many regions; operationally distinct runnings ⇒ separate Editions linked via `advances_to_edition_id`.

**All pre-R1-1 modeling blockers are resolved (2026-07-07) — the R1-1 schema migration is unblocked.**

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
- **`competition.summary`** — curated 1–2 sentence card blurb (clamp-2); falls back to truncated
  `description` when absent. S4 curation writes both.
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
- **Validation bounds (server = source of truth; forms mirror):** grades `-1..12` (the entity
  comment's "13 reserved" is NOT accepted yet — loosening validation later is cheap, owner);
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
(`countPublicListings`). `listing_status` is **not** in the predicate yet (that column is Phase-3
item 14); at R1 the gate + `archived_at` are the whole rule. The source-side fix — combined
create-competition-with-first-edition (`POST /admin/competitions/with-edition`,
`ListingCurationService`, one transaction) — makes admin-created listings complete-by-default.
`approved_at`/`approved_by` deferred to item 14 (owner, 2026-07-15).

**Columns (migration `0010`, additive):** `competition.approved_at timestamptz NULL`,
`approved_by uuid NULL` (FK-less, like `organizer_org_id`), `listing_status varchar NOT NULL DEFAULT
'PUBLISHED'` (enum `DRAFT|PUBLISHED|UNLISTED`). **Backfill** existing rows `listing_status='PUBLISHED'`,
`approved_at=created_at` (already live + vetted). `archived_at` stays the archive signal; no CHECK
constraint (enum-as-varchar house rule, §8).

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

Cross-ref: Q3 (region granularity) · §8a (lifecycle) · registry H24 (stages/rounds) / HC5
(advancement) · glossary (Edition / Stage / Round / Advancement).
