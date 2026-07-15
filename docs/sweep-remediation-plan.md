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

This doc now carries the current **Now — Opus** build (the R1 listing-lifecycle essentials), the
**Phase 2** and **Phase 3** batched items, plus prior-rounds history and a couple of open carry-over
notes.

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

## Prior rounds — Opus (mechanical) · ✅ built & verified (2026-07-13)

Items 1–5 — form-alignment foundations, confirm hard deletes, table dates → `lib/dates`, regions
full CRUD + their own `/admin/regions` page, and the mechanical polish batch — shipped in `a2454e9`
/ `a24406e` / `f8ad11a`, each verified live. As-built detail is in the git history; the durable
conventions were migrated to `architecture.md` §13a.

## Prior rounds — Fable (design-heavy) · ✅ built & verified (2026-07-13/14)

Items 6–7 — the universal form-postable + searchable `Select` (rolled out across all 16 admin
dropdowns) and the admin form architecture pass — shipped in `4798545` / `15ff24d` / `dc6eb99` /
`c10374f`, verified live. The durable capabilities were migrated to `design-brief.md` §3 and
`architecture.md` §13a.

---

## Now — Opus · R1 listing-lifecycle build (to build)

Triaged 2026-07-14 (owner): of the full §8a lifecycle, only two pieces are **Phase-1 essential, and
neither needs schema** — a light-loop build, safe to land before R1-12. The `listing_status` state
machine + host publish controls are **deferred to Phase 3** (item 14); at R1, archive + restore + the
readiness gate already cover "take it down" and "not ready." Full design: `domain-model.md` §8a.

### Readiness gate — public reads require a live edition · no schema · **essential**
Replace the bare `c.archived_at IS NULL` base filter with `archived_at IS NULL AND
EXISTS(non-archived edition)` across the browse feed, `CompetitionSearchService`, detail (`/c/<slug>`
→ 404 when none), sitemap, and landing featured/hero; facet counts use the same predicate. **Kills
zombie listings** — a competition with no edition (from admin-create *or* import-approve) is invisible
until it has one. The one launch-quality fix.

### Combined create-competition + first-edition form · no schema · **recommended**
The create page captures the competition shell **+ a "First edition"** (= the year's running, per
glossary): cycle label, status, scope, headline deadline (a `REG_CLOSE` `KeyDate`), registration URL,
entry fee. One server action creates the competition **then** its first edition + key date (single
transaction preferred). Makes admin listings complete-by-default (source fix for the gate above +
fewer steps). No "Save as draft" button yet (that needs `listing_status` — Phase 3). Future editions
use the existing Editions tab.

### Approval stamp — `approved_at` / `approved_by` · 1 additive column pair · *optional now*
The foundation you asked for: auto-stamped on admin create + import approve (`approved_by` null until
RBAC R2-7). Does nothing observable at R1 (always auto-true; no review exists) and is **additive**, so
it lands equally cheaply in Phase 3 item 14. **Owner's call:** include the small migration now for the
visible seam, or defer at zero cost.

---

## Phase 2 — R2 schema/payload batch (don't build now)

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

---

## Phase 3 — Host Tools, lifecycle machine & structure (don't build now)

### 13. Competition structure — Edition → Stage → Round (H24/H25)

Logged 2026-07-14. An R1 `Edition` carries a **single** date/fee set and `delivery` is
competition-level, so a tiered competition (local → regional → national) can't vary deadlines,
costs, or delivery **per level**. **Target model** (domain-model **§8b** + glossary): the *annual
cycle* is the **Edition** (one per year); each per-place level-instance is a **Stage** (Texas
Regional, National Tournament — owns its own dates/cost/registration/region, linked by `advances_to`);
a **Round** is a sequential phase *within* a Stage. Built by registry **H24/H25** at **Phase 3**,
designed at Gate A (don't harden early). **R1 interim:** one running = one `Edition` record +
per-level milestones as `KeyDate`s; describe the tier structure + a "find your regional" link in the
description/FAQ; show the Edition's default cost/deadline with a "select your region for specifics"
disclaimer. **Do not** hand-model tiers as separate Editions at R1. Full context: `domain-model.md`
§8b (+ §8a lifecycle).

### 14. Listing-status state machine + host publish controls — deferred from §8a

The rest of the R1 lifecycle design, deferred 2026-07-14 because its real driver — self-serve hosts —
is Phase 3, and R1 is already covered by archive/restore + the readiness gate (Now — Opus). Adds
migration `0010` `listing_status` (`DRAFT|PUBLISHED|UNLISTED`, plus `IN_REVIEW`), the Publish / Unlist
/ Re-list admin actions + status badges + "Save as draft," and the §8a Phase-3 seams: **IN_REVIEW /
DQ12** pre-publication review (an edit keeps the live version public while the change is re-reviewed),
**`visibility`** (public / link-only / invite-only, H48), **`list_at`** scheduled listing. If
`approved_at`/`approved_by` weren't pulled into Now — Opus (optional there), they land here too.
Additive — re-composes cleanly onto the readiness gate; nothing built now needs rework. Full design:
`domain-model.md` §8a.
