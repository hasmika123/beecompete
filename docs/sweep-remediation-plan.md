# Sweep remediation — remaining backlog (rev 2026-07-13, round 4)

**History.** Rounds 1–3 (the 2026-07-13 admin/marketplace audit + the owner's round-2/3
feedback) are **fully built** on branch `fix/filter-panel-ux-and-landing-stats` (commits
`00aff4d`…`07fcd7e`, local, verified live) — completed items are removed from this doc; their
durable decisions live in `domain-model.md` §3f/§8, `page-blueprints.md` decisions #32–36,
`glossary.md`, and CLAUDE.md's current-state note; per-item as-built detail is in the git
history. This doc now carries **only** (a) the **round-4 admin-UI audit backlog** (owner
request 2026-07-13: every admin page examined in source + measured live in the browser) and
(b) the **R2-batched items**.

Ground rules still apply: additive-only migrations; server is the source of truth; all shared
UI from `packages/ui`; Conventional Commits.

**Carry-over verification:** the org-trust positive detail render (org verified seal +
host-maintained line) was never confirmed in a browser (local dev SSR cache) — **re-verify
once on staging** after this branch deploys.

---

## Round-4 audit — the measured evidence (context for items 1–7)

- **Misalignment mechanism A (~11px):** `FormField`'s root is `grid gap-1.5`; inside a
  multi-column section grid, equal-height row stretch redistributes extra height into the
  hint-less field's label/control rows, pushing its control ~11px below a hinted neighbor.
  Measured: competition form Name 614 vs Slug 603, Cost 1432 vs Team-size-min 1421, Max-grade
  1721 vs Min-grade 1710; edition form Status 161 vs Cycle 150, Scope 265 vs Advances-to 254,
  Fee 459 vs Currency 448; resource add-row Type 430 vs Order 419.
- **Misalignment mechanism B (~22px):** inline add-rows (`flex items-end`) align field
  WRAPPER bottoms, so a field whose hint hangs below its control floats the control up.
  Measured: category-create Parent 155 vs Name/Slug 177; region-add Parent 887 vs 909.
- **16 native dropdowns** whose expanded popups can't match the universal Select styling:
  competition form ×7, edition form ×3, key-dates ×2, resource type, org form type, org
  header trust, category create/edit parent, region level/parent, featured picker,
  attributes-fields enums.
- **Hard deletes (key date / FAQ / resource) have NO confirm** while recoverable archives do.
- **Server-locale dates** in three list tables (`toLocaleDateString()` server-side).
- Structural: edition form has untitled sections; Format section = 3-col bag with an orphan
  row; 2,600px-tall competition form with Save below the fold; dashboard 4+1 orphan card row;
  ragged hero-form Save buttons (814 vs 748); regions are create-only (API has no
  update/delete) and live confusingly on the Categories page.

---

## Now — Opus (mechanical; spec-complete) — ✅ ALL BUILT 2026-07-13

Shipped in three commits (`a2454e9` items 1–3, `a24406e` item 4, `f8ad11a` item 5), each
verified live against the local stack. **One sub-item deferred** (row-click lists — see item 5).
As-built notes inline below.

### 1. Form-alignment foundations — S — ✅ built (`a2454e9`)

> **As built:** mechanism A fixed with the one-line `content-start` on FormField — verified
> every measured pair now shares one control top (competition + edition forms, resource
> Type/Order). Mechanism B: dropped the Parent below-control hint on category-create +
> region-add (kept `items-end`, which already bottom-aligns) — all controls + submit button
> share one baseline. FAQ Order+Add → `items-end`, `mt-6` deleted; resource affiliate/Add →
> `mb-2` deleted. **Variation:** kept `items-end` (not the plan's `items-start`) and `size="sm"`
> buttons — `items-end` bottom-aligns the shorter button onto the 40px control row cleanly, so
> no button-height change was needed; the only real bug was the Parent hint.

Original plan (kept for reference):

1. **Mechanism A, one line:** add `content-start` to `FormField`'s root
   (`packages/ui/src/components/form-field.tsx` — `'grid gap-1.5'` →
   `'grid content-start gap-1.5'`). Internal rows stop absorbing row-stretch; every measured
   11px pair snaps to a common top. Re-measure the competition + edition forms after
   (`getBoundingClientRect().top` equal across each row).
2. **Mechanism B:** inline add-row forms (category-create, region-add) get NO below-control
   hints — fold them into labels ("Parent (optional)"); switch the rows from
   `flex items-end` to `items-start` (uniform label+control cells align tops, and bottoms
   now match since no cell has a third row).
3. **Button height in field rows:** inline add-row submit buttons (`categories`, `regions`,
   FAQ, resources) go `size="sm"` → default md (40px = control height) and align via the
   same row rule — delete the `mt-6` (FAQ) and `mb-2` (resources) magic numbers.
4. FAQ's Order+Add row: put Order and the button in the same grid row as proper cells
   (Order keeps `w-24`; button `self-end`), not a nested flex with offsets.

### 2. Confirm hard deletes — S — ✅ built (`a2454e9`)

> **As built:** `useConfirm` on key-date, FAQ, resource Delete ("permanent — no restore",
> danger). Verified: dialog appears, Cancel preserves, Delete removes.

Key-date, FAQ, and resource Delete are instant PERMANENT deletes; wire the existing
`useConfirm` (exactly the archive/reject pattern): `key-date-manager.tsx`,
`faq-manager.tsx`, `resource-manager.tsx` — confirm
`{ title: 'Delete this …?', message: 'This is permanent — there is no restore.',
tone: 'danger' }`, render `{dialog}` once per manager. No API change.

### 3. Table dates → `lib/dates` helpers — S — ✅ built (`a2454e9`)

> **As built:** all 3 sites (competitions "Updated", import + corrections "Submitted") →
> `formatDate` (Eastern fallback). Grep confirmed no remaining `toLocale` in admin.

Replace `new Date(x).toLocaleDateString()` (server-locale/zone!) with `formatDate`/
`compactDateInZone` from `@/lib/dates` (Eastern fallback) in: competitions list "Updated",
import queue "Submitted", corrections "Submitted". Grep for any remaining `toLocale` in
`apps/web/src/app/admin` + `components/admin` and sweep them all.

### 4. Regions: full CRUD + their own page — M — ✅ built (`a24406e`)

> **As built:** PUT/DELETE endpoints (self-parent → 422, unknown parent → 422, child regions →
> 409, still-tagged-on-edition → 409, else 204 — all verified). New `/admin/regions` page +
> sidebar (MapPin); `RegionAdmin` = aligned create row + editable table (inline edit form per
> row + confirmed delete surfacing the 409 message as a toast). Categories page decluttered;
> `region-manager` deleted; `createRegion` moved to `regions/actions`; RegionTagger copy → "under
> Regions". Verified live end-to-end.

1. **API** (`RegionAdminController` — currently GET+POST only):
   `PUT /api/v1/admin/regions/{id}` (name, code, level, parentId — validate parent exists +
   isn't self) and `DELETE /api/v1/admin/regions/{id}` — hard delete guarded by FKs
   (`edition_region` rows or child regions ⇒ 409 with an explicit message, matching the
   category-delete pattern). Bean Validation mirrors the create shape.
2. **Web:** new `/admin/regions` page + sidebar entry (icon: `MapPin`), moving `RegionManager`
   off the Categories page. Upgrade it from chips to an `AdminTable` (Name / Level / Code /
   Parent / actions) with inline edit (row → small form, same pattern as the hero-card forms)
   and a confirmed Delete. The create row stays on top (item-1 alignment rules).
3. Categories page drops its Regions card and the "under Categories → Regions" copy in
   `RegionTagger`'s empty state updates to "under Regions".

### 5. Mechanical polish batch — S — ✅ built (`f8ad11a`), **1 sub-item deferred**

> **As built (verified live):** dashboard regrouped into *Catalog* (3) + *Review queues* (2),
> queue tiles get a danger border+bg+label when pending > 0 (verified with a seeded pending
> row); editions Status/Scope → outline `Badge`; org header trust select wrapped in a visible
> "Trust:" label; landing hero-card label → "Image (S3 key or URL)", `linkUrl` `type="url"`,
> all three hero Save buttons bottom-aligned (was 814/748 → all 850); corrections "Fields" cell
> truncated with `title`; import payload textarea shows a live invalid-JSON `error` (verified
> `aria-invalid` + hint toggling).
> **Deferred — row-click lists:** making the whole `AdminTable` row clickable relies on a
> stretched-link over `<tr>`, which has unreliable `position: relative` support on table rows;
> the alternative (client-component row with `router.push`) would convert the server-rendered
> table just for this. Not worth the fragility/cost — the name-cell link already navigates.
> Revisit if AdminTable becomes a client component for other reasons.

- **Dashboard:** split the 4+1 orphan grid into two labeled groups — *Catalog*
  (Competitions/Organizations/Categories, 3-col) and *Review queues* (Pending imports/
  corrections, 2-col) with a danger-tinted count badge when pending > 0.
- **Editions tab:** status/scope cells → `Badge` (match sibling tables' treatment).
- **Org header:** visible quiet label before the trust select ("Trust:"), not aria-only.
- **Landing:** hero-card label → "Image (S3 key or URL)"; `linkUrl` input gets `type="url"`;
  bottom-align the three hero Save buttons (grid rows: form content `1fr` + button row) so
  MAIN's extra fields stop making its Save sit 66px lower.
- **Corrections list:** truncate the "Fields" cell (`truncate` + `title` attr) so many-key
  payloads don't stretch the row.
- **Import review:** reuse the attributes-fields invalid-JSON inline hint on the payload
  textarea (parse on change, `aria-invalid` + quiet danger line; server stays the gate).
- **Lists:** make the whole row clickable where the row has exactly one destination
  (competitions, organizations, both queues) — keep the name link for a11y, add a row-level
  `cursor-pointer` + onClick nav or a stretched-link cell pattern.

---

## Now — Fable (design-heavy)

### 6. Universal dropdowns in admin: form-postable + searchable `Select` — M
*(owner 2026-07-13: searchable variant styling = builder judgment, inherits the locked
Select popover look; owner steers reactively)*

1. **`Select` gains form participation:** optional `name` prop → renders
   `<input type="hidden" name value>` synced to the selection, so it drops into the admin's
   uncontrolled FormData forms without conversion to controlled state. Optional `required`:
   visually mark + block submit via the hidden input's validity (set
   `setCustomValidity`/`required` on a visually-hidden real input if the hidden type proves
   non-validating — verify at impl; fallback: forms that need it are already
   server-validated, mirror with an inline error on submit).
2. **`Select` gains `searchable`:** when set (or automatically at ≥ ~12 options), the popover
   pins a small filter `Input` above the option list (same field radius, hairline divider
   below it); typing filters options (case-insensitive substring), ArrowDown moves from the
   filter into the list, Enter commits the active option, Escape clears-then-closes. Empty
   result renders a quiet "No matches." row. Focus returns to the trigger on close
   (existing behavior). Styling: nothing new beyond the locked popover tokens.
3. **Swap all 16 sites** (inventory above) from `NativeSelect` to `Select`: uncontrolled
   forms use `name` + `defaultValue`; already-controlled sites (org trust, featured picker,
   attributes enums, edition status) use `value`/`onValueChange`. Searchable on: Organizer,
   category/region Parent, Advances-to, featured picker, Timezone (7 options — skip), region
   level (skip). Delete `NativeSelect`; move `enumLabel`/`enumOptions` to
   `components/admin/enum-labels.ts` (or `lib/`), updating ~10 imports.
4. **Verify live:** popover styling identical to the marketplace panel's; keyboard path
   (Tab → trigger → Enter → type-to-filter → Enter commits → value posts in FormData);
   a required category still blocks/creates correctly; long org list filters.

### 7. Admin form architecture pass — M — ✅ built (`<item-7>`)

> **As built (verified live):** `FormSection` extracted to
> `components/admin/form-section.tsx` and used by the competition + edition forms (the only
> multi-section forms). Edition form → 5 titled sections (Cycle & status ·
> Registration · Fees & prize · Advancement · Attributes), all rows verified aligned.
> Competition Format → 2 clean 3-col rows with **Team size as one paired min–max field**
> (`aria-label`s keep the two inputs screen-reader-distinct); Evaluation types AND Tags get
> full-width rows in Classification & links (leaves Official URL | Logo as a clean pair — no
> orphans). **Sticky save bar** (always sticky — simpler than a taller-than-viewport toggle,
> harmless on short forms) on both forms: `sticky bottom-0` + `bg-background` + hairline top
> border, holds Save + the server-error Alert (moved down from the form top so failures appear
> where you clicked); verified pinned mid-scroll at 900px viewport and on mobile. Widths:
> sectioned forms `max-w-3xl`, simple forms stay `max-w-xl` (template editor deliberately
> full-width — wide JSON textarea). Key-date add form → Type | Starts | Timezone / Ends |
> Label | TBD (checkbox centered on the control band via `mt-[26px] h-10`) + slim button row;
> TBD-disabled inputs already muted by Input's `disabled:opacity-45`. "Dates live on Editions"
> Alert moved to the top of the Editions tab; kept in the FORM only on the create page
> (`!editing`), which has no tabs yet. Responsive pass: 1100px — fixed theme toggle (y≤50)
> clears PageHeader actions (y≥68) on competition + org pages; mobile — no h-scroll, fields
> stack, paired team field fits one line, fixed toggle hidden (top bar hosts its own).

1. **Extract `FormSection`** from `competition-form.tsx` into
   `components/admin/form-section.tsx` (title · optional description · top rule · `cols`
   prop) and use it in EVERY multi-section admin form.
2. **Edition form:** restructure into titled sections — *Cycle & status* (cycle, status,
   scope) · *Registration* (URL, age cutoff) · *Fees & prize* (fee, currency, prize ×3) ·
   *Advancement* (advances-to) · *Attributes*. Kills the orphan Registration-URL half-row.
3. **Competition Format section reflow:** Participation | Delivery | Entry pathway /
   Cost | Recurrence | **Team size** (min+max as ONE paired field: two 40px inputs joined
   with an en-dash, one label, one disabled state) — no orphan row. **Evaluation types**
   moves to its own full-width row (the 5-checkbox group wraps raggedly beside an input —
   measured 52px vs 40px).
4. **Sticky save bar** on the competition (and edition) form: a bottom-pinned bar
   (`sticky bottom-0`, surface bg, hairline top border) holding Save + the error Alert
   anchor, so the action never sits 2,600px below the fold. Appears only when the form is
   taller than the viewport (or always — builder judgment at impl).
5. **Standard form widths:** simple forms (org, category edit) stay `max-w-xl`; sectioned
   forms cap at `max-w-3xl`–`4xl` for line-length sanity inside the `max-w-5xl` shell —
   pick one scale and apply.
6. **Key-date add form:** two aligned rows — Type | Starts | Timezone / Ends | Label |
   (TBD checkbox inline, vertically centered) — button in the second row's end or a slim
   third row; disabled date inputs get muted styling while TBD is checked.
7. **Move the "dates live on Editions" Alert** from the bottom of the competition form to
   the top of the Editions tab.
8. **Verification pass** at 1440 + ~1100px (check the fixed theme toggle vs `PageHeader`
   actions collision at narrow desktop) + mobile top-bar layout.

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
