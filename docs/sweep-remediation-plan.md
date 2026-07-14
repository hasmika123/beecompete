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

This doc now carries **only the Phase-R2-batched items** (deferred until the R2 schema/payload work)
plus a couple of open carry-over notes.

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
