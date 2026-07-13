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

This doc now holds **only the remaining work**, grouped by when/how to build it. Ground rules
still apply: additive-only migrations; server is the source of truth; all shared UI from
`packages/ui`; Conventional Commits.

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
judgment — a workhorse pass. Suggested as **one PR** (items 1–4 touch adjacent admin surfaces),
docs (5) and tests (6) can ride along or follow.

### 1. Admin queue reachability (the A6 follow-up) — M

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

### 2. Expose Edition `advancesToEditionId` in the edition form — S

Audit HIGH: the column exists (R1-1) but the admin edition form never surfaces it, so
advancement chains can't be curated. Add a `NativeSelect` of the competition's other editions
(exclude self) + clear option; plain nullable-UUID write through the existing edition action.

### 3. `evaluationType` free-text CSV → checkbox group — S

Replace the competition form's free-text CSV input with a checkbox group of the 5 canonical
tokens (mirror `EvaluationTypes.TOKENS` as a const in `admin-types.ts` — `submission, exam,
live_performance, interview, portfolio`). Couples to the competition action's parsing: switch
that field from CSV-split to `formData.getAll(...)`. Server already validates tokens at the
write boundary (R1-5) — this is pure UX hardening.

### 4. Featured-manager archived filter — S

The landing admin picker's `allCompetitions` payload is `{id, name}` only, so archived
competitions are selectable. Have the landing admin page pass `archivedAt` (or pre-filter
server-side) and exclude archived from the picker.

### 5. "Request a Competition" docs propagation — S (docs only)

The public rename shipped (how-it-works + suggest pages); the canonical label decision —
**"Request a Competition"** supersedes "Suggest a competition" — still needs propagating:
CLAUDE.md, `page-blueprints.md` (43/143/261/322/370), `design-brief.md:180`,
`feature-registry.md` DQ15, `glossary.md`. Route slug `/suggest-a-competition` may stay
(rename at R1-15b when the wizard is built, with a redirect if changed).

### 6. Test-debt payoff (optional, decoupled) — S–M

- `apps/web`: add the Vitest harness (mirror `packages/ui`'s setup) + unit tests for
  `zonedWallClockToInstant` (DST edges: spring-gap, fall-back, half-hour zones),
  `isHostMaintained` (no org / curated / claimed / verified), `activeChips` band suppression,
  `listingHealth`.
- `apps/api`: validator tests for the A5 rules + `EffectiveStatus` with a null-date REG_CLOSE
  (no NPE, stays OPEN). Needs Docker/Testcontainers only for repository tests — validator +
  EffectiveStatus tests are plain JUnit.

---

## Now — Fable (design-heavy; the one item needing real judgment)

### 7. Schema-driven attributes form (the A7 renderer) — M–L

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
mode switching are the judgment calls; everything else in this backlog is paint-by-numbers.

---

## Phase R2 — batch with the R2 schema/payload work (don't build now)

These all reopen API payloads or schema that R2 tasks touch anyway (R2-1 FKs, R2-7 RBAC,
R2-10 search/popularity). Building them now means touching those surfaces twice.

### 8. Import → created-competition link — schema (additive)

Approving an import creates a competition but records no link. Add
`import_record.created_competition_id` (additive column; owner explicitly deferred 2026-07-13),
stamp it at approve, render a "created listing" link on reviewed import detail/rows.

### 9. Card-level "Date TBD" label — search projection

Detail pages show "Deadline · TBD" (shipped); cards show nothing for TBD-only competitions
(owner deferred 2026-07-13). Design: the search projection surfaces a `deadline_tbd` boolean
(`EXISTS (… kd.type IN (REG_CLOSE, SUBMISSION_DUE) AND kd.starts_at IS NULL)` when
`next_deadline IS NULL`) → `CompetitionSummary.deadlineTbd` → `toCardData` maps
`deadlineLabel: 'Date TBD'`. Pairs naturally with R2-10's search work (popularity sort touches
the same native SQL + payload).

### 10. Listing-health v2 checks — admin payload

The v1 checklist (shipped) omits two checks because the admin edition-list payload carries no
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
