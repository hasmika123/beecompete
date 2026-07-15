# Sweep remediation — remaining backlog (rev 2026-07-14)

**History.** The 2026-07-13 admin/marketplace audit (rounds 1–3) and the round-4 admin-UI pass are
**fully built and verified live** (local branch; per-item as-built detail is in the git history).
Durable decisions from the now-completed work were migrated to their home docs before the task
bodies were removed here:

- `architecture.md` §13a — **admin form conventions** (`Select` for all dropdowns, `FormSection`,
  sticky save bar, form widths, the `— none —` clearable-select sentinel, `enum-labels` location,
  `FormField` `content-start`).
- `design-brief.md` §3 — **`Select` form-participation (`name`) + `searchable` variant**.
- `domain-model.md` §3f/§8 and `page-blueprints.md` #32–36 — earlier-round data/layout decisions.

This doc now carries the **R1 listing-lifecycle foundation** (owner-approved 2026-07-14, not yet
built) and the **Phase-R2/R3-batched items**, plus a couple of open carry-over notes.

Ground rules still apply: additive-only migrations; server is the source of truth; all shared UI
from `packages/ui`; Conventional Commits.

**Open carry-overs:**

- **Org-trust positive detail render** (org verified seal + host-maintained line) was never confirmed
  in a browser (local dev SSR cache) — **re-verify once on staging** after this branch deploys.
- **Deferred: whole-row-click on admin list tables.** Making the whole `AdminTable` row clickable
  relies on a stretched-link over `<tr>`, which has unreliable `position: relative` support on table
  rows; the alternative (a client-component row with `router.push`) would convert the server-rendered
  table just for this. Not worth the fragility/cost — the name-cell link already navigates. Revisit
  if `AdminTable` becomes a client component for other reasons.

---

## Now — Opus (mechanical; spec-complete) — ✅ ALL BUILT & VERIFIED (2026-07-13)

Items 1–5 — form-alignment foundations, confirm hard deletes, table dates → `lib/dates`, regions
full CRUD + their own `/admin/regions` page, and the mechanical polish batch — shipped in `a2454e9`
/ `a24406e` / `f8ad11a`, each verified live. As-built detail is in the git history; the durable
conventions were migrated to `architecture.md` §13a.

## Now — Fable (design-heavy) — ✅ ALL BUILT & VERIFIED (2026-07-13/14)

Items 6–7 — the universal form-postable + searchable `Select` (rolled out across all 16 admin
dropdowns) and the admin form architecture pass — shipped in `4798545` / `15ff24d` / `dc6eb99` /
`c10374f`, verified live. The durable capabilities were migrated to `design-brief.md` §3 and
`architecture.md` §13a.

---

## Now — listing lifecycle foundation (R1) — 🔒 schema · owner-approved 2026-07-14, not yet built

Full design + rationale: **`domain-model.md` §8a** and the 3-era diagram (design artifact). Untangles
the four axes (approval · listing-status · visibility · run-status); **R1 builds the first two + the
readiness gate.** Everything visibility- or host-facing (IN_REVIEW/DQ12, `visibility`, `list_at`,
edit-re-review) is a **Phase-3 seam — designed, not built.** This is 🔒 full-loop work (plan → 🧑 →
build); it also anticipates RBAC (R2-7) filling `approved_by`.

### L1. Lifecycle columns — migration `0010` (additive) + entity
- `competition`: `approved_at timestamptz NULL`, `approved_by uuid NULL` (FK-less), `listing_status
  varchar NOT NULL DEFAULT 'PUBLISHED'` (enum `DRAFT|PUBLISHED|UNLISTED`; no DB CHECK — §8 house rule).
- **Backfill** existing rows: `listing_status='PUBLISHED'`, `approved_at=created_at` (already live +
  vetted → nothing de-lists). `archived_at` stays the archive signal (ARCHIVED = `archived_at` set).
- JPA: add fields + `ListingStatus` enum (`@Enumerated(STRING)`); `ddl-auto: validate` stays green.

### L2. Set + transition on the write paths
- Admin **create** and import **approve** stamp `approved_at=now()` (auto-approved). `approved_by`
  null at R1 (no admin user identity until RBAC R2-7).
- New **Publish / Unlist / Re-list** admin actions move `listing_status`. **Publish gate:** refuse
  unless the competition has ≥ 1 non-archived edition (server mirror of the read gate; **409** +
  explicit reason via `ApiExceptionHandler`).
- **Archive auto-unlists for free** — the read gate already requires `archived_at IS NULL`, so an
  archived listing is never public regardless of `listing_status`.

### L3. Public read gate (catalog.web + search + sitemap + landing)
- Replace the bare `c.archived_at IS NULL` base filter with
  `archived_at IS NULL AND listing_status='PUBLISHED' AND EXISTS(non-archived edition)` across the
  browse feed, `CompetitionSearchService`, detail, sitemap, landing featured/hero. **Kills zombie
  listings** (live with no edition/deadline). Facet counts use the same predicate.

### L4. Combined create-competition + first-edition form
- The create page captures the competition shell **+ a "First edition"** (= the year's running, per
  glossary): cycle label, status, scope, headline deadline (a `REG_CLOSE` `KeyDate`), registration
  URL, entry fee. One server action creates the competition **then** its first edition + key date
  (single transaction preferred), landing `listing_status=PUBLISHED` — or `DRAFT` via "Save as draft."
  No schema change beyond L1. Future editions use the existing Editions tab.
- **Admin UI:** status badge (Draft / Published / Unlisted) on the list + detail header; Publish /
  Unlist / Re-list buttons (header actions, `useConfirm` where destructive); "Save as draft" on
  create. `listing-health` stays the *soft* nudge; the **publish gate** is the hard one.

### L5. Docs
- `domain-model.md` §8a ✅, `glossary.md` lifecycle terms ✅; add a `page-blueprints.md` note for the
  combined create form (structure change to the admin create surface).

**Sequencing:** L1→L2→L3 are one 🔒 schema PR (full loop). L4 rides on top (form + actions) and should
land **with** L3 so "publishable by default" and "can't publish a shell" arrive together.

---

## Phase R2 — batch with the R2 schema/payload work (don't build now)

### 8. Import → created-competition link — schema (additive)

Approving an import creates a competition but records no link. Add
`import_record.created_competition_id` (additive column; owner explicitly deferred
2026-07-13), stamp it at approve, render a "created listing" link on reviewed import
detail/rows.

### 9. Card-level "Date TBD" label — search projection

Detail pages show "Deadline · TBD" (shipped); cards show nothing for TBD-only competitions
(owner deferred 2026-07-13). Design: the search projection surfaces a `deadline_tbd` boolean
(`EXISTS (… kd.type IN (REG_CLOSE, SUBMISSION_DUE) AND kd.starts_at IS NULL)` when
`next_deadline IS NULL`) → `CompetitionSummary.deadlineTbd` → `toCardData` maps
`deadlineLabel: 'Date TBD'`. Pairs naturally with R2-10's search work (popularity sort
touches the same native SQL + payload).

### 10. Listing-health v2 checks — admin payload

The v1 checklist omits two checks because the admin edition-list payload carries no
key-date/region aggregates (no-new-fetches rule): *current edition has a REG_CLOSE or
SUBMISSION_DUE key date (dated or TBD)* and *current edition has ≥1 region*. Add a small
key-date/region summary to the edition list payload when R2 admin work reopens it, then add
the two checks (+ the deferred list-page health column, which needs the same aggregates).

### 11. Retire the vestigial verification write paths — rides R2-7 (RBAC)

Competition/edition `setVerification` endpoints exist but nothing calls them, and the columns
are held at `CURATED` (domain-model §3f). When R2-7 replaces the shared-secret admin auth with
real RBAC (and the claim flow formalizes org-ladder writes, DQ11), remove the dead endpoints +
request-DTO field, and consider a CHECK or code-level assert that competition/edition
`verification_state` stays `CURATED`. Columns themselves stay (additive-only).

### 12. Edition RegionTagger at scale — after region seeding

The edition Regions card is a flat checkbox list — fine at a handful of regions, unusable at
50 states + counties. Once the geo seed lands: group checkboxes by level/parent (Country →
States expandable), add a filter input, show selected-count. UI-only; do it when the data
actually makes the flat list hurt.

### 13. Per-round deadlines / costs / delivery — Round entity (Phase 3, H24)

Logged 2026-07-14. An R1 `Edition` carries a **single** date/fee set and `delivery` is
competition-level, so a tiered competition (local → regional → national) can't vary deadlines,
costs, or delivery **per level**. Canonical model (glossary): those levels are **Rounds** of one
Edition — built by registry **H24** (with H23 divisions + H25 advancement) at **Phase 3**, informed
by Gate-A fair research (don't harden early). **R1 workaround:** one Edition per running + per-round
milestones as `KeyDate`s (typed/custom-labeled); describe the tier structure in the description/FAQ.
**Do not** model tiers as separate Editions (muddies "Edition" and still can't vary delivery). Full
context in `domain-model.md` §8a + feature-registry H24.
