# Sweep remediation — remaining backlog (rev 2026-07-13)

Source: the full admin/app audit run 2026-07-13 (three-agent code sweep + live browser
verification). **The bulk of the plan shipped the same day** on branch
`fix/filter-panel-ux-and-landing-stats` (commits `00aff4d`…`3db0525`, local); the completed
designs were removed from this doc and their **durable decisions moved to the planning docs**:

- **`domain-model.md` §3f** — org-only trust ladder (CURATED → CLAIMED → VERIFIED; `UNVERIFIED`
  retired; competition maintainer derived from the organizer org; migration `0009`).
- **`domain-model.md` §8** (sweep as-built block) — TBD key dates (nullable `starts_at`,
  migration `0008`), key-date timezone semantics (`zonedWallClockToInstant` / `formatInZone`),
  validation bounds (grades −1..12, fees ⇒ currency, cross-field ranges; failures return
  **400**), and the deliberate non-constraints (no team-size×participation hard rule; organizer
  + deadline never required — the listing-health checklist surfaces completeness instead).
- **`page-blueprints.md` decisions #32–36** — instant-apply filter panel + "Clear all",
  band↔quick-chip canonicalization, invariant 270px card tracks, one-line card titles +
  share-only corner (R2 slot for Save/social-proof), collapsed-by-default facets / no panel
  scroll.
- **`glossary.md`** — "Verification / Trust Ladder" entry rewritten to the org ladder.
- **CLAUDE.md** current-state — sweep summary; R1-9's listing tier marked superseded.

This doc now holds **only the remaining work**, grouped by when/how to build it — including
the **owner's round-3 feedback (2026-07-13, after the build)**: card fixed-slot anatomy, the
4/3 column grid, universal dropdowns in the filter panel, bottom-edge panel stickiness (all
→ item 9), and the admin collapse-button fix (→ item 7). The round-3 "By organization"
Categories section was **deferred to Phase 3 by the owner** — recorded on **M32** in the
feature registry, not here. Ground rules still apply: additive-only migrations; server is the
source of truth; all shared UI from `packages/ui`; Conventional Commits.

Two carry-over facts an implementer should know:

- **A2 render caveat:** the positive detail render (org verified seal + host-maintained line
  for a claimed/verified org) was never confirmed in a browser — a sticky local dev SSR cache
  served a pre-change render. API/DB confirmed correct; the derivation is a typechecked
  conditional. **Re-verify once on staging** after the branch deploys.
- **Test debt:** `apps/web` has no test harness (converter/`isHostMaintained`/`activeChips`
  were verified live, not by committed tests); the new API validation rules have no committed
  `@WebMvcTest`s (needs Docker/Testcontainers locally). Folded into item 6 below.

---

## Now — Opus (mechanical; the patterns all exist in the codebase)

Everything here is spec-complete, follows an existing in-repo pattern, and needs no design
judgment — a workhorse pass. Suggested as **one PR** (items 1–4 + 7 touch adjacent admin
surfaces); docs (5) and tests (6) can ride along or follow.

### 1. Admin queue reachability (the A6 follow-up) — M — ✅ built 2026-07-13

> **As built:** all five sub-items shipped and verified live (get-by-id → read-only
> `ReviewOutcome` panel for reviewed records; every queue row links; pagination via a new
> shared `AdminPagination` (competitions page refactored onto it); `subjectName` batch-resolved
> server-side (≤3 queries/page); reject confirms via `useConfirm` + "Note (optional)").
> **Variation:** the carousel-Remove confirm was deliberately skipped — Remove only edits
> local state (nothing persists until "Save carousel"), so a confirm there is noise, not
> safety. Org search needed no API work (the endpoint already had `query`/`page`).

1. **Get-by-id endpoints.** `GET /api/v1/admin/import-records/{id}` (and mirror for
   corrections if its detail page digs through the list — verify at impl). Detail pages fetch
   by id → deep links + back-after-decision work for ANY status. Reviewed records render a
   read-only outcome panel (status badge + note + reviewed date).
2. **Non-PENDING rows become links** in both queues (works once #1 lands).
3. **Pagination + search.** Reuse the competitions-list pattern (page param + shared
   pagination UI): organizations (currently hard `size=100`, no search — add a `q` name filter
   to the org admin endpoint), import-records, corrections (both `size=50`).
4. **Corrections queue subject names.** Extend the corrections list payload with
   `subjectName` (single JOIN server-side against competition — never N+1 from the web).
   Column shows the name; UUID demoted to a tooltip/secondary line.
5. **Confirm dialogs on the remaining destructive actions** via the existing
   `useConfirm`/ConfirmDialog (`packages/ui`, shipped in the sweep): **Reject** (both queues)
   and carousel **Remove**. Reject's note stays **optional**, relabeled "Note (optional)"
   (owner decision C4). Archive (competition + org) already has confirms.

### 2. Expose Edition `advancesToEditionId` in the edition form — S — ✅ built 2026-07-13

Audit HIGH: the column exists (R1-1) but the admin edition form never surfaced it, so
advancement chains couldn't be curated. **As built:** `NativeSelect` of the competition's other
editions (self excluded on the edit page; every edition is a candidate on the new-edition page)
+ "— none —" clear option; the action already wrote the field. Both edition pages fetch
`/competitions/{id}/editions`. Verified live (set state→national, persisted). The field hides
when there are no sibling editions (nothing to advance into).

### 3. `evaluationType` free-text CSV → checkbox group — S — ✅ built 2026-07-13

**As built:** `EVALUATION_TYPES` const in `admin-types.ts` (`exam, submission,
live_performance, interview, portfolio` — lowercase, matching the R1-5 canonical tokens); the
competition form's free-text input is a `Checkbox` group; the action parses via a new
`multi()` helper (`formData.getAll`). Server still validates at the write boundary. Verified
live (check exam+submission → persisted `['exam','submission']` → round-trips checked on
reload).

### 4. Featured-manager archived filter — S — ✅ built 2026-07-13

**As built:** the landing picker payload now carries `archived: c.archivedAt !== null`;
`FeaturedManager` keeps the full map for resolving already-featured names but filters archived
out of the add-list (`!ids.includes(c.id) && !c.archived`). Verified live (archived a
competition → absent from the picker → restored).

### 5. "Request a Competition" docs propagation — S (docs only) — ✅ built 2026-07-13

**As built:** the canonical DQ15 label **"Request a Competition"** (supersedes "Suggest a
competition") propagated to CLAUDE.md, `page-blueprints.md` (footer link, zero-results CTA,
Page 6 heading, decision #19, status table), `design-brief.md`, `feature-registry.md` DQ15,
`phase-1-plan.md`. **Kept unchanged:** "Suggest a **correction**" (DQ6 — a different feature)
and the route slug `/suggest-a-competition` (renames at R1-15b when the wizard is built).
`glossary.md` has no DQ15 term entry, so nothing to reconcile there.

### 6. Test-debt payoff (optional, decoupled) — S–M

- `apps/web`: add the Vitest harness (mirror `packages/ui`'s setup) + unit tests for
  `zonedWallClockToInstant` (DST edges: spring-gap, fall-back, half-hour zones),
  `isHostMaintained` (no org / curated / claimed / verified), `activeChips` band suppression,
  `listingHealth`.
- `apps/api`: validator tests for the A5 rules + `EffectiveStatus` with a null-date REG_CLOSE
  (no NPE, stays OPEN). Needs Docker/Testcontainers only for repository tests — validator +
  EffectiveStatus tests are plain JUnit.

### 7. Admin sidebar collapse button "randomly disappears" — S — ✅ built 2026-07-13

> **As built:** applied `lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto` to the aside root.
> Verified live on a tall page: aside is now `position: sticky`, exactly viewport-height, and
> the Collapse button stays within the viewport (bottom y=884 of a 900px viewport) even after
> scrolling to y=2000 — where it previously fell off-screen. No `overscroll-contain` needed.

**Root cause (diagnosed, not random):** the admin shell (`apps/web/src/app/admin/layout.tsx`)
is a `min-h-dvh flex` row, so the sidebar `<aside>` **stretches to the height of the page
content**. The collapse button is pinned to the aside's bottom (`mt-auto`,
`admin-sidebar.tsx`). On short pages (dashboard) the aside ≈ viewport → button visible; on
tall pages (an opened competition's tabs/forms, the categories list) the aside is thousands of
px tall → the button sits at the *page* bottom, far below the fold. It "disappears" exactly on
tall pages.

**Fix — pin the rail to the viewport on desktop:** give the aside
`lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto` (mobile is a top bar — untouched). The rail
then never exceeds the viewport, `mt-auto` pins Collapse to the *viewport* bottom on every
page, and a nav taller than the viewport scrolls inside the rail instead of pushing the button
away. Steps: (1) add the classes to the aside root in `admin-sidebar.tsx`; (2) verify on the
three reported page shapes (dashboard, competition detail, categories) + collapsed state +
mobile; (3) check no descendant needs `overscroll-contain` (rail scroll shouldn't chain to the
page). Rejected alternative: making only the button `sticky bottom-0` inside the tall aside —
leaves the nav itself unreachable-without-scrolling-the-page on tall pages; the sticky rail is
the standard admin-shell pattern.

---

## Now — Fable (design-heavy / visual-fidelity work)

Two efforts. Item 8 needs design judgment (schema→widget mapping); item 9 is the owner's
round-3 marketplace feedback (2026-07-13) — pixel-exact fit math and card-anatomy work on the
most-seen public surface, where two previous rounds have bounced, so it gets the strongest
model and ships as **one coherent PR** verified live (same files throughout:
`competition-card.tsx`, `marketplace-frame.tsx`, `marketplace-page.tsx`, `filter-panel.tsx`).

### 8. Schema-driven attributes form (the A7 renderer) — M–L

Today the admin edits a competition's `attributes` bag as raw JSON in a textarea. The uiHints
wipe bug is already fixed (textarea round-trips); the renderer remains. Highest
admin-ergonomics leverage of the backlog. Design (preserved from the original plan):

1. **`uiHints` shape** (nothing consumes it yet — this contract is authoritative):

   ```json
   { "order": ["topics", "rounds"],
     "labels": { "topics": "Covered topics" },
     "placeholders": { "topics": "algebra, geometry" },
     "widgets": { "notes": "textarea" } }
   ```

2. **Renderer** `components/admin/attributes-fields.tsx` (client):
   `<AttributesFields schema uiHints value onChange>` supporting the subset the 11 launch
   templates use — `properties` of type `string` (→ `Input`; `enum` → `NativeSelect`;
   `format: uri` → `type=url`), `number`/`integer` (→ number `Input` w/ schema min/max),
   `boolean` (→ `Checkbox`), `array` of strings (→ CSV `Input`, or chips later). Any
   unsupported property (nested object, `oneOf`, array-of-object) falls back to a raw JSON
   sub-textarea **for that key only**; a global "Edit raw JSON" toggle preserves today's
   full-textarea mode.
3. **Data flow:** controlled object in the form → serialized into the existing hidden
   `attributes` field on submit, so the server action + networknt schema validation path is
   untouched (server stays the real gate).

Why Fable: the JSON-Schema→widget mapping, per-key fallback ergonomics, and the controlled↔raw
mode switching are the judgment calls.

### 9. Marketplace visual pass, round 3 (owner 2026-07-13) — M, one PR

Four interlocking fixes. **Blueprint-first rule applies:** amend `page-blueprints.md`
decisions #34/#35/#36 (and add the fixed-slot card anatomy as a new decision) as part of the
PR — the numbers below change what those decisions recorded.

#### 9a. Card fixed-slot anatomy — every card, identical rows

**Owner spec:** cover → **1 line** tags → **1 line** title → **1 line** avatar + org name +
verified seal → **2 lines** description → Cost/Region row → Prize/Deadline row.

**Current gap** (`packages/ui/src/components/competition-card.tsx`): the organizer row
(`data.organizerName && …`) and the description (`data.summary && …`) are **conditionally
rendered**, so cards missing either have shorter header blocks — the facts/footer stay
bottom-pinned via `mt-auto`, but the middle rows misalign across a row of mixed cards.

**Design:**

1. **Organizer row always renders** with a fixed height (`h-6`, the avatar size). When no
   organizer: **blank reserved space** (owner 2026-07-13) — an empty div holding the height;
   never imply an organizer that isn't on record. Keep the current avatar + truncated name +
   `VerifiedSeal` when present.
2. **Description always renders at exactly 2 lines:** keep `line-clamp-2` and add a 2-line
   min-height — prefer `min-h-[2lh]` (the `lh` unit tracks the real line-height; supported in
   all evergreen browsers), fallback `min-h-10` (2 × text-sm/5) if `lh` misbehaves in the
   verify pass. Render the element even when `summary` is absent.
3. **Tag line:** already a single fixed-height row (CategoryTag always present; grade badge
   optional, never wraps) — just pin an explicit height (`h-6`) so a missing badge can't
   change it. Title is already one truncated line.
4. With every slot fixed-height, `mt-auto` on the facts row becomes a no-op safety net — keep
   it, note why in the comment.
5. **Verify:** a sparse card (no org, no summary, no grade, no prize) next to a full card —
   every horizontal rule lines up pixel-identical. Update `competition-card.test.tsx`
   (reserved slots render when data is absent) and the `/design` showcase note.

#### 9b. Grid columns: 4 closed / 3 open (currently 3/2) — the container math

**Root cause (measured, not a bug in the grid):** the public shell caps content at
`max-w-6xl` = 1152px with `px-6` → **1104px** usable (`app/(public)/layout.tsx`). The sweep
set fixed 270px tracks + `gap-6` (24px): closed needs 4×270 + 3×24 = **1152px > 1104** → only
3 fit; open leaves 1104 − 270 − 24 = 810px, and 3×270 + 2×24 = 858 > 810 → 2 fit. Exactly the
reported 3/2.

**Design — shrink the track (and the panel with it) to fit the container:** invariant card
width requires `panel = track` exactly (closed `4w + 3g` = open `w + g + 3w + 2g`). Solve for
the container: `w = (1104 − 3×24) / 4 = 258px`. So:

1. Define the width **once** as a token — `--card-w: 258px` in `packages/ui/styles/tokens.css`
   — and consume it everywhere (Tailwind v4 arbitrary values read vars):
   `CardGrid` → `sm:grid-cols-[repeat(auto-fill,var(--card-w))]`; the marketplace aside →
   `w-(--card-w)`; the landing featured-row, categories closing-soon row, and detail
   related-row `w-[270px]` wrappers → `w-(--card-w)` (one card width platform-wide, no magic
   numbers in four files).
2. Keep `gap-6`. Closed: 4×258 + 72 = 1104 — exact fit. Open: 258 + 24 + 3×258 + 48 = 1104 —
   exact fit. The owner's "decrease the panel width if necessary" falls out automatically
   (270 → 258).
3. Below the max-width (smaller desktops), `auto-fill` degrades gracefully to 3/2 columns;
   phones keep the fluid single column. No breakpoint work.
4. **Verify live** (this math bounced once already): at ≥1152px viewport,
   `getBoundingClientRect().width === 258` on cards in BOTH panel states, 4 vs 3 columns, no
   horizontal overflow; re-check 1280/1440/1920.
5. Amend blueprint decision #34 (records 270px) to the container-derived 258px.

*Rejected alternative:* widening the shell to `max-w-7xl` to keep 270px cards — reflows every
public page (landing, detail, categories) for a 12px card gain; not worth it. If the owner
later wants bigger cards, that's the lever, decided at the shell level.

#### 9c. Filter-panel dropdowns → the universal `Select`

**Root cause:** the panel's Grade From/To (and Region) use `NativeSelect` — an admin
component wrapping a **native `<select>`**, whose expanded popup is OS-rendered and cannot be
styled. The "universal dropdown" is `packages/ui` **`Select`** (custom listbox: 16px-radius
panel, hairline border, popover shadow, check-marked active option — exactly what the toolbar
Sort uses). No amount of CSS fixes a native popup — swap the component.

**Design:**

1. Replace the three `NativeSelect`s in `filter-panel.tsx` with ui `Select`
   (controlled: `value` + `onValueChange={(v) => set({ … })}`). Prepend an explicit clear
   option (`{ value: '', label: 'Any' }` / `'Anywhere'`) — a custom listbox has no native
   blank option, and clearing must stay possible. Keep the aria-labels and the count-suffixed
   option labels.
2. This also removes the admin-component import from public UI (`@/components/admin/…` in
   `filter-panel.tsx` — a layering smell; public surfaces should compose from `packages/ui`).
3. **Watch:** inside the mobile bottom sheet (`overflow-y-auto`) the in-tree popover may clip
   at the sheet's bottom edge for the last facets — verify; if it clips, portal the listbox to
   `document.body` the way `ShareMenu` already does (reuse that pattern, don't invent one).
4. Keyboard pass: ArrowUp/Down + Enter + Escape already work in ui `Select`; confirm focus
   returns to the trigger after instant-apply navigation re-renders the panel.

#### 9d. Filter panel: stick at the BOTTOM edge, not the top

**Owner spec:** while scrolling down, the panel scrolls with the page and pins only when its
**bottom edge reaches the viewport bottom** (today: `sticky top-20` pins it at the top
immediately).

**Design — measured-height sticky offset (no scroll listeners):** a sticky element pins when
its top hits `top`; setting `top = 100dvh − panelHeight − margin` makes that moment exactly
"bottom touches viewport bottom". The panel's height changes as facets expand, so measure it:

1. In `marketplace-frame.tsx`, ref the desktop aside and attach a **`ResizeObserver`** that
   writes the measured height to a CSS var on the element
   (`el.style.setProperty('--panel-h', `${h}px`)`).
2. Aside classes: keep `sticky self-start`, replace `top-20` with
   `top-[calc(100dvh-var(--panel-h,100dvh)-1.5rem)]` (1.5rem breathing room; the `100dvh`
   fallback = never pins before first measure). Short panel or tall: the same rule yields
   "pins when the bottom clears the viewport bottom" — no top-stick, per the owner.
3. Mobile sheet untouched (it's an overlay). The observer lives only while the panel is open
   (it mounts/unmounts with it) — no leak.
4. **Verify:** collapsed-facets (short) panel and all-facets-open (tall) panel both scroll
   with the page and pin at the bottom edge; expanding a facet while pinned re-measures and
   re-pins correctly; no jump on open/close.

*Rejected alternatives:* pure-CSS `top: calc(100dvh − 100%)` (percent doesn't resolve against
the element's own height in `top`), and flex/double-wrapper hacks (brittle once facet heights
are dynamic). ResizeObserver + one CSS var is the smallest robust mechanism.

*(A "By organization" browse section on the Categories page was requested in this round and
**deferred to Phase 3** by the owner — recorded on **M32** in the feature registry, since it
needs the public org list + an `org` search facet that ship with the org directory.)*

---

## Phase R2 — batch with the R2 schema/payload work (don't build now)

These all reopen API payloads or schema that R2 tasks touch anyway (R2-1 FKs, R2-7 RBAC,
R2-10 search/popularity). Building them now means touching those surfaces twice.

### 10. Import → created-competition link — schema (additive)

Approving an import creates a competition but records no link. Add
`import_record.created_competition_id` (additive column; owner explicitly deferred 2026-07-13),
stamp it at approve, render a "created listing" link on reviewed import detail/rows.

### 11. Card-level "Date TBD" label — search projection

Detail pages show "Deadline · TBD" (shipped); cards show nothing for TBD-only competitions
(owner deferred 2026-07-13). Design: the search projection surfaces a `deadline_tbd` boolean
(`EXISTS (… kd.type IN (REG_CLOSE, SUBMISSION_DUE) AND kd.starts_at IS NULL)` when
`next_deadline IS NULL`) → `CompetitionSummary.deadlineTbd` → `toCardData` maps
`deadlineLabel: 'Date TBD'`. Pairs naturally with R2-10's search work (popularity sort touches
the same native SQL + payload).

### 12. Listing-health v2 checks — admin payload

The v1 checklist (shipped) omits two checks because the admin edition-list payload carries no
key-date/region aggregates (no-new-fetches rule): *current edition has a REG_CLOSE or
SUBMISSION_DUE key date (dated or TBD)* and *current edition has ≥1 region*. Add a small
key-date/region summary to the edition list payload when R2 admin work reopens it, then add
the two checks (+ the deferred list-page health column, which needs the same aggregates).

### 13. Retire the vestigial verification write paths — rides R2-7 (RBAC)

Competition/edition `setVerification` endpoints exist but nothing calls them, and the columns
are held at `CURATED` (domain-model §3f). When R2-7 replaces the shared-secret admin auth with
real RBAC (and the claim flow formalizes org-ladder writes, DQ11), remove the dead endpoints +
request-DTO field, and consider a CHECK or code-level assert that competition/edition
`verification_state` stays `CURATED`. Columns themselves stay (additive-only).
