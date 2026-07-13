# Sweep remediation — implementation plans (2026-07-13)

Source: the full admin/app audit run 2026-07-13 (three-agent code sweep + live browser
verification). This doc is the **approved implementation plan** for the complicated findings —
written so an implementing session can execute without re-investigating. Part A = designed
plans, Part B = the straightforward fix checklist, Part C = decision points (each with a
recommended default so work never stalls), plus suggested PR slicing.

Ground rules that apply throughout: additive-only migrations; server is the source of truth
(client validation mirrors it); all shared UI from `packages/ui`; Conventional Commits;
schema-touching PRs run the full loop (this doc serves as their plan artifact).

---

## Part A — designed plans

### A1. Key-date timezone correctness (+ `endsAt` / `label`) — bug, HIGH

**Problem.** `addKeyDate` (`apps/web/src/app/admin/competitions/[id]/editions/actions.ts`)
converts the `datetime-local` string with `new Date(local).toISOString()` **inside the server
action**, so the wall-clock is interpreted in the *server's* zone (UTC in prod) — not the
admin's browser and not the IANA `timezone` field the admin picked. The chosen timezone is
stored as a dead label. Every key date entered while server tz ≠ intended tz stores a wrong
instant, which flows into public deadlines, effective status, and the deadline filter.

**Design.**

1. **Converter** — add `zonedWallClockToInstant(local: string, timeZone: string): string` in
   `apps/web/src/lib/dates.ts` (server-safe, no deps), using the standard two-pass
   Intl offset probe:

   ```ts
   // parse "YYYY-MM-DDTHH:mm" → numeric parts; guess = Date.UTC(parts)
   // offset(utcMs, tz) = wallClock(formatToParts(utcMs, tz)) - utcMs
   // candidate = guess - offset(guess, tz)
   // re-probe: if offset(candidate, tz) !== offset(guess, tz), candidate = guess - offset(candidate, tz)
   // return new Date(candidate).toISOString()
   ```

   This matches `date-fns-tz`'s `fromZonedTime` behavior, incl. DST edges (spring-forward gaps
   resolve to the shifted instant; fall-back ambiguity resolves deterministically to the first
   offset). Alternative if hand-rolling is unwanted: add `date-fns-tz` — but the helper is
   ~20 lines and unit-testable, so prefer no new dep.

2. **Timezone input → dropdown.** Replace the free-text IANA `Input` in
   `key-date-manager.tsx` with a `NativeSelect`: common zones (America/New_York, Chicago,
   Denver, Los_Angeles, Anchorage, Honolulu, UTC) + keep the current stored value as an option
   when editing rows created with something else. **Default `America/New_York`** (matches the
   public Eastern-fallback rule in `lib/dates.ts`). Store the zone explicitly — never empty.

3. **Action fix.** `addKeyDate`: `startsAt = zonedWallClockToInstant(startsAtLocal, timezone)`.
   Same for `endsAt` (below). Delete the `new Date(...).toISOString()` path.

4. **Add the missing fields** (same form, same PR):
   - `endsAt` — optional second `datetime-local` "Ends (optional)", converted with the SAME
     zone. Client + server rule: `endsAt` requires `startsAt` and must be after it
     (`@AssertTrue` on `KeyDateRequest`).
   - `label` — optional `Input maxLength={200}` ("Label (optional) — shown for Custom dates").
     Render it in the list row when present (esp. for `CUSTOM`, which today shows just
     "custom").

5. **Display fix.** The list row currently does `new Date(k.startsAt).toLocaleString()`
   (server-local). Format in the key date's stored zone instead:
   `new Intl.DateTimeFormat('en-US', { timeZone: k.timezone ?? 'America/New_York', dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' })`
   — ideally as a small `formatInZone()` helper next to the converter.

6. **Existing data audit.** Wrong instants can't be auto-corrected (original intent unknown).
   Ship a one-off check: list all key dates + zones, eyeball against organizer sites (catalog
   is still small). No migration.

**Tests.** Unit: converter across EST/EDT boundary (US DST 2026: Mar 8 / Nov 1), UTC,
half-hour zone (Asia/Kolkata), gap time (2:30 AM Mar 8). Integration: create 19:00
America/New_York in July → stored `23:00Z`.

**Size:** S–M. No schema change (`ends_at`, `label`, `timezone` columns already exist).

---

### A2. R1-19 — org trust ladder + derived competition maintainer — schema

**Owner rule (2026-07-13, refined).** Trust lives on the **organization only**, as a ladder:

| Org state | Meaning |
|---|---|
| `CURATED` | **Unclaimed** — BeeCompete maintains the record. Verification does not apply at all here. |
| `CLAIMED` | A host claimed the org — **not (yet) verified**. |
| `VERIFIED` | Claimed **and** identity-verified. `VERIFIED` implies claimed — verification only exists for claimed orgs. |

**Competitions (and Editions) carry NO trust state of their own** — never
verified/unverified, and not individually claimed or curated either. Their maintainer status
is **derived from the organizer org**: when a host claims an organization, all of its
competitions become host-maintained; while the org is curated (unclaimed), all of its
competitions are curated. A competition with **no organizer** is curated by definition.
Claiming is therefore a pure derivation — no cascade writes to competitions, ever.

**Design:**

1. **Org enum usage.** Reuse the existing `VerificationState` enum; org-legal values are
   `CURATED | CLAIMED | VERIFIED` (`UNVERIFIED` retired). `OrganizationCurationService`
   rejects `UNVERIFIED` with a 422 + explicit message. Javadoc documents the ladder and
   "VERIFIED implies claimed".

2. **Competition/Edition `verification_state` becomes vestigial.** Nothing reads it anymore
   — not the public API mapping, not the web, not the admin UI. The curation write path stops
   accepting it (drop from the request DTO or ignore) and always stamps the constant
   `CURATED`. The column stays (additive-only); mark it deprecated in entity Javadoc with a
   pointer to this rule.

3. **Migration (additive changeset `0008`)** — data only:

   ```sql
   UPDATE organization SET verification_state = 'CURATED' WHERE verification_state = 'UNVERIFIED';
   UPDATE competition  SET verification_state = 'CURATED';  -- vestigial, tidied to the constant
   UPDATE edition      SET verification_state = 'CURATED';  -- vestigial, tidied to the constant
   ```

   Optional CHECKs after the UPDATEs: organization IN ('CURATED','CLAIMED','VERIFIED');
   competition/edition = 'CURATED'.

4. **Derivation — one rule, computed web-side (zero public-API change).** Both the card
   summary and the detail payload already expose `organizer.verificationState`, so the web
   derives everything:

   ```
   hostMaintained(competition) = organizer != null
                                 && organizer.verificationState ∈ { claimed, verified }
   ```

   Add it as a tiny helper (e.g. `lib/catalog-display.ts: isHostMaintained()`) so the rule
   exists in exactly one place. The payload's competition-level `verificationState` field can
   keep being emitted for compatibility, but the web stops reading it; mark deprecated.

5. **Admin UI.**
   - `competition-header-actions.tsx`: **remove the verification select entirely**
     (archive/restore stays). There is nothing to set at competition level anymore.
   - Competitions **list column** "Verification": **drop it** (the A4 listing-health
     checklist covers attribution; deriving it in the list would need org state joined into
     the admin list payload — not worth it).
   - `org-header-actions.tsx`: three options via a new `ORG_TRUST_STATES` const in
     `admin-types.ts` — labeled `Curated (unclaimed)` / `Claimed (unverified)` / `Verified`.
     `VERIFICATION_STATES` (4 values) is deleted once nothing references it.

6. **Public trust panel redesign** (`apps/web/src/components/detail/trust-panel.tsx`) — this
   also kills the live contradiction ("Unverified" badge above "Curated by the BeeCompete
   team"). New rendering rules, top to bottom:
   - **Org seal line** (only when org is `verified`): `VerifiedSeal` + "Verified organizer" —
     the ONLY "verified" language on the page.
   - **Maintained-by line** (always, from the derivation helper): host-maintained →
     "Listing maintained by {organizer.name}."; otherwise → "Listing maintained by the
     BeeCompete Curation Team." (locked wording).
   - **Provenance line** (as today): source + confidence + last-verified date.
   - **Claim CTA**: shown when NOT host-maintained (org curated, or no organizer).
   - Delete the `TrustBadge tier={competition.verificationState}` + tier-blurb rendering.
     `TrustBadge`/`trustTierMeta` are re-scoped to the ORG ladder (blurbs rewritten:
     curated = "Maintained by the BeeCompete curation team", claimed = "Claimed by the
     organizer — identity not yet verified", verified = "Organizer identity verified by
     BeeCompete"); `unverified` tier + `isElevatedTier` deleted with their last usages.
     Cards are already compliant (org seal only).

7. **Docs.** Replace the "pending realignment" warning in `domain-model.md` §3f with the new
   rule (org ladder + derived maintainer; Competition/Edition state vestigial); update the
   glossary "Verification / Trust Tier" entry to the org ladder; mark R1-19 done in
   phase-1-plan; update the CLAUDE.md R1-9 current-state note.

**Phase 0 (optional interim, ships in minutes if full R1-19 waits):** in `trust-panel.tsx`,
stop rendering the tier badge/blurb entirely and derive the maintained-by line from the org
per rule 4 — the web-side half of this design works without any schema change.

**Tests.** Service: org set to UNVERIFIED → 422; competition write ignores/stamps CURATED.
Web unit tests for `isHostMaintained` across the four cases (no org / curated org / claimed
org / verified org); trust-panel render for the same four. Migration verified by
`ddl-auto: validate` boot + a repository test asserting the constants.

**Size:** M. Full loop (schema). Note the web-display half (rules 4–6) is schema-independent
and can ship first as its own light-loop PR.

---

### A3. R1-18 — "TBD" deadlines — schema

**Model.** A key date whose `starts_at IS NULL` means "this milestone exists but its date is
TBD". Applies to **any** `KeyDateType` (uniform; see decision C6).

1. **Migration (additive changeset)** — `ALTER TABLE key_date ALTER COLUMN starts_at DROP NOT NULL;`
   (constraint *relaxation* — non-destructive, allowed under additive-only; say so in the
   changeset comment). Entity: remove `@NotNull` from `KeyDate.startsAt` + `nullable = false`.
   DTO: `KeyDateRequest.startsAt` optional; **new rule**: `endsAt != null ⇒ startsAt != null`
   (`@AssertTrue`, shared with A1's after-check).

2. **`EffectiveStatus` — critical NPE fix.** `earliest()` streams
   `.map(KeyDate::getStartsAt).min(naturalOrder())` — a null date **throws NPE** today, it
   doesn't just misbehave. Add `.filter(k -> k.getStartsAt() != null)` before the map. A TBD
   REG_CLOSE therefore never renders CLOSED (correct).

3. **Search is already null-safe** (verified): the deadline lateral filters
   `kd.starts_at > :now` (NULL excluded by SQL semantics) and the deadline sort is already
   `NULLS LAST`. A TBD-only competition simply carries no `next_deadline` — no SQL change
   needed for correctness.

4. **Admin UI** (`key-date-manager.tsx`): a "Date TBD" `Checkbox` per add-row. Checked →
   disable + clear the `datetime-local`, drop `required`, submit no `startsAt` (the action's
   `startsAt ? … : null` path already tolerates empty once the input stops blocking it).
   List rows render **"TBD"** (muted) for null dates. Postgres orders `ASC NULLS LAST` by
   default, so repository `OrderByStartsAt` lists TBD rows last automatically — verify once.

5. **Public rendering:**
   - **Timeline** (`key-dates-timeline.tsx` + `detail-display`): null-date items render a
     "TBD" chip instead of a date, sorted last; skip ics/Google add-to-calendar links for
     them (nothing to export).
   - **At-a-glance**: if a future dated deadline exists → today's behavior; else if a
     REG_CLOSE/SUBMISSION_DUE key date with null date exists → show `Deadline · TBD`; else
     omit the row (today's behavior).
   - **Card** (phase 2, optional): showing "TBD" on cards needs the search projection to also
     surface a `deadline_tbd` boolean (`EXISTS (… kd.type IN (REG_CLOSE,SUBMISSION_DUE) AND
     kd.starts_at IS NULL)` when `next_deadline IS NULL`) → `CompetitionSummary.deadlineTbd`
     → `toCardData` maps `deadlineLabel: 'Date TBD'`. Ship the detail-page TBD first; add
     this only if cards should say TBD too.

6. **Types:** web `KeyDate.startsAt: string | null` (public + admin payload types).

**Tests.** EffectiveStatus with a null-date REG_CLOSE (stays OPEN, no NPE); repository round-
trip with null starts_at; web: timeline renders TBD chip; at-a-glance TBD row.

**Size:** M (M+ with the card boolean). Full loop (schema).

---

### A4. Listing-health checklist (answers "should organizer/deadline be required?")

**Decision embedded here:** neither becomes hard-`required`. Organizer must stay nullable
(imports start unattributed — entity + docs are explicit); deadline can't exist at
competition-create (dates live on Edition key dates, D3). Enforcement UX = a **derived
completeness checklist**, no schema.

1. **Helper** `apps/web/src/lib/listing-health.ts`:
   `listingHealth(competition, editions, faqs, resources): HealthCheck[]` where
   `HealthCheck = { key, label, ok, detail? }`. Checks (v1):
   - has organizer (`organizerOrgId != null`) — *"unattributed listing"*
   - has summary · has description
   - has ≥1 non-archived edition
   - current edition has a REG_CLOSE or SUBMISSION_DUE key date (dated **or TBD** once A3
     lands) — *"no deadline on record"*
   - current edition has a registration URL
   - current edition has ≥1 region
2. **Component** `components/admin/listing-health.tsx`: a `Card` titled "Listing health" —
   one row per check, `CheckCircle` (success) / `Warning` (warning tone) icon + label; all-ok
   collapses to a single "Complete ✓" line. Purely informational — never blocks saves.
3. **Placement:** admin competition page Details tab, above the form (the page already
   fetches editions/faqs/resources for tab counts — no new fetches). A list-page column needs
   child aggregates in the admin list endpoint — defer.
4. **Future hook:** this component is the natural home for an explicit "approved/listed"
   status if R2+ adds a draft/publish gate.

**Size:** S.

---

### A5. Validation hardening — exact spec

Server first (source of truth), forms mirror. All bounds currently client-only.

**`CompetitionRequest`** (Java record — put `@AssertTrue` on instance methods):

| Field | Add |
|---|---|
| `minGrade`, `maxGrade` | `@Min(-1) @Max(12)` (see decision C3) |
| `minAge`, `maxAge` | `@Min(0) @Max(25)` |
| `teamSizeMin`, `teamSizeMax` | `@Min(1)` |
| cross-field | `@AssertTrue isGradeRangeValid()` (`min==null || max==null || min<=max`); same for ages, team sizes |
| team-size gating | **no hard server rule** (imports may carry sloppy data — decision C5); UI-only |

**`EditionRequest`:**

| Field | Add |
|---|---|
| `entryFee`, `prizeValue` | `@PositiveOrZero @Digits(integer = 10, fraction = 2)` |
| `currency`, `prizeCurrency` | `@Pattern(regexp = "[A-Z]{3}")` (null allowed) |
| cross-field | `@AssertTrue`: `entryFee != null ⇒ currency != null`; `prizeValue != null ⇒ prizeCurrency != null` |

**`KeyDateRequest`:** `@AssertTrue`: `endsAt == null || (startsAt != null && endsAt.isAfter(startsAt))` (shared with A1/A3).

**Form mirrors** (client): competition grade `max={13}` → `max={12}`; team-size inputs
disabled + cleared when `participationMode === 'INDIVIDUAL'` (client-side `useState` watch);
fee/prize `min={0}`; currency inputs `pattern="[A-Za-z]{3}"` + uppercase on submit
(`.toUpperCase()` in the action); missing `maxLength`s: slug 160, officialUrl/logo/
registrationUrl 1000, category slug 140.

`ApiExceptionHandler` already surfaces messages — give each `@AssertTrue` a clear
`message = "…"`. Tests: one `@WebMvcTest`/validator unit per rule.

**Size:** S–M, mechanical.

---

### A6. Admin queues & reachability — get-by-id, pagination, names, confirmations

1. **Get-by-id endpoints.** Add `GET /api/v1/admin/import-records/{id}` (and mirror for
   corrections if its detail page also digs through the list — verify at impl). Detail pages
   fetch by id → deep links + back-after-decision work for ANY status. Reviewed records
   render a read-only outcome panel (status badge + note + reviewed date). Linking an
   approved import to the created competition needs an additive
   `import_record.created_competition_id` column — **phase 2, optional** (column doesn't
   exist today; verified).
2. **Non-PENDING rows become links** in both queues (works once #1 lands).
3. **Pagination + search.** Reuse the competitions-list pattern (page param + shared
   pagination UI): organizations (currently hard `size=100`, no search — add `q` name filter
   to the org admin endpoint), import-records, corrections (both `size=50`).
4. **Corrections queue subject names.** Extend the corrections list payload with
   `subjectName` (single JOIN server-side against competition — never N+1 from the web).
   Column shows the name, UUID demoted to a tooltip/secondary line.
5. **`ConfirmDialog` in `packages/ui`.** Small wrapper over the existing `Modal`:
   `<ConfirmDialog title message confirmLabel tone onConfirm>` + a `useConfirm()` hook. Apply
   to: Archive (competition + org), Reject (both queues), carousel Remove. Reject keeps its
   note field **optional** but relabeled "Note (optional)" (decision C4).
6. **Org restore.** Add `restoreOrganization` server action + API call (competitions already
   have the endpoint pattern) and render Archive/Restore toggle in `org-header-actions.tsx`
   exactly like `competition-header-actions.tsx:50-58`.

**Size:** M (spread across small API + web changes).

---

### A7. Schema-driven attributes form (+ the `uiHints` wipe fix) — larger, do last

1. **Bug fix first (tiny, independent):** `putCategoryTemplate` hardcodes `uiHints: null`,
   wiping stored hints on every save. Add a "UI hints (JSON, optional)" textarea to
   `template-editor.tsx` round-tripping the existing value.
2. **Define the `uiHints` shape** (nothing consumes it yet — this doc fixes the contract):

   ```json
   { "order": ["topics", "rounds"],
     "labels": { "topics": "Covered topics" },
     "placeholders": { "topics": "algebra, geometry" },
     "widgets": { "notes": "textarea" } }
   ```

3. **Renderer** `components/admin/attributes-fields.tsx` (client):
   `<AttributesFields schema uiHints value onChange>` supporting the subset the 11 launch
   templates use — `properties` of type `string` (→ `Input`; `enum` → `NativeSelect`;
   `format: uri` → `type=url`), `number`/`integer` (→ number `Input` w/ schema min/max),
   `boolean` (→ `Checkbox`), `array` of strings (→ CSV `Input`, or chips later). Any
   unsupported property (nested object, `oneOf`, array-of-object) falls back to a raw JSON
   sub-textarea **for that key only**; a global "Edit raw JSON" toggle preserves today's
   full-textarea mode.
4. **Data flow:** controlled object in the form → serialized into the existing hidden
   `attributes` field on submit, so the server action + networknt schema validation path is
   untouched (server stays the real gate).

**Size:** M–L. Highest admin-ergonomics leverage; schedule after A1–A6.

---

## Part B — straightforward fixes (no design needed)

Terminology (rename → "Request a Competition"):
- [ ] `how-it-works/page.tsx:188` button text
- [ ] `suggest-a-competition/page.tsx:9` metadata title; `:21` `<h1>`; `:23` body copy
      ("suggestion form" → "request form")
- [ ] Docs propagation: CLAUDE.md, page-blueprints (43/143/261/322/370), design-brief:180,
      feature-registry DQ15, glossary — reconcile the canonical DQ15 label

Styling / consistency:
- [ ] `admin-table.tsx:29` — drop the outer border wrapper around `EmptyState` (double border)
- [ ] Enum rendering → `enumLabel()` everywhere: `organizations/page.tsx:37`,
      `competitions/[id]/page.tsx:63,110-111`, `landing/page.tsx:36` (inline re-impl)
- [ ] Edition status/scope in tables → badges (match sibling tables) — optional polish
- [ ] **Mobile theme-toggle collision** (verified live): wrap the fixed toggle in
      `hidden lg:block`; render a second static `ThemeToggle` inside the sidebar's top row
      with `lg:hidden` (mobile top bar gets it inline, desktop keeps the floating corner)
- [ ] Admin dates: 4 `toLocale*` call sites → `lib/dates.ts` helpers (or A1's
      `formatInZone`) for consistency

Small UX:
- [ ] Featured manager: disable Save at 0 items; show "Maximum of 10 featured picks" note
      instead of silently hiding the add control; add an empty state; filter archived
      competitions out of `available` (admin list payload already carries `archivedAt`)
- [ ] Competitions-list search: add a submit `Button` + a clear (✕) link
- [ ] `evaluationType` free-text CSV → checkbox group of the 5 canonical tokens (mirror
      `EvaluationTypes.TOKENS` as a const in `admin-types.ts`)
- [ ] FAQ answer textarea `rows={2}` → `rows={4}`
- [ ] Hero-card image preview: when `imageKey` is a full URL, render a small `<img>` preview
      (same rule the landing page uses — `hero-cards.tsx:12`); S3-key upload remains PR C
- [ ] Category create form: add the Parent `NativeSelect` (edit form already has it)
- [ ] Region manager: add Parent `NativeSelect` (regions tree — COUNTRY→STATE nesting)
- [ ] Resource manager: add `displayOrder` number input (or up/down reorder like Featured);
      FAQ-manager parity
- [ ] Empty states: pass `description` + action (e.g. "New competition") through `AdminTable`

## Part C — decision points (recommended defaults inline)

| # | Decision | Recommendation |
|---|---|---|
| C1 | Org trust states | **RESOLVED (owner 2026-07-13):** ladder `CURATED` (unclaimed — verification N/A) → `CLAIMED` (unverified) → `VERIFIED` (claimed + verified). `UNVERIFIED` retired. See A2. |
| C2 | Competition-level trust state | **RESOLVED (owner 2026-07-13):** competitions have none — maintainer is derived from the organizer org (org claimed/verified ⇒ all its competitions host-maintained; org curated or no org ⇒ curated). Column vestigial, tidied to constant `CURATED`. See A2. |
| C3 | Grade upper bound (entity comment says "13 reserved") | **12 everywhere** (server `@Max(12)` + form `max=12`); relax later if the reserved 13 ever ships — validation loosening is cheap |
| C4 | Reject-note: require a note on queue rejections? | **Optional, relabeled "Note (optional)"** + confirm dialog (A6.5) |
| C5 | Team-size vs participation mode: hard server rule? | **No hard rule** (imports carry sloppy data); client-side disable + listing-health warning |
| C6 | TBD allowed on all key-date types or only deadline types? | **All types** (uniform model, simpler UI) |

## Suggested PR slicing (order)

1. **PR-B** — Part B checklist (light loop; no schema)
2. **PR-A1** — key-date timezone + endsAt/label (bug fix; light loop)
3. **PR-A6** — queues: get-by-id, pagination, subject names, ConfirmDialog, org restore
4. **PR-A5** — validation hardening (API + form mirrors)
5. **PR-A3** — R1-18 TBD deadlines (schema; full loop)
6. **PR-A2** — R1-19 maintainer realignment (schema; full loop) — or ship its Phase-0
   trust-panel line first inside PR-B if R1-19 waits
7. **PR-A4** — listing-health checklist
8. **PR-A7** — uiHints fix (can ride PR-B) + schema-driven attributes form
