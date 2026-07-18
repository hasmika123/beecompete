# Sweep remediation — remaining backlog (rev 2026-07-18)

**History.** The 2026-07-13 admin/marketplace audit + the 2026-07-15/16 sweep build (readiness gate,
combined complete-by-default create, create-form stepper, and Now-bucket items **15–22**) are **fully
built and shipped** (in prod as of R1.2). Durable decisions were migrated to their home docs —
`architecture.md` §13a/§2, `setup-runbook.md` §6, `domain-model.md` §3f/§8/§8a, `page-blueprints.md`
#32–37 — so this doc now carries only the **not-yet-built** work below.

Ground rules: additive-only migrations; server is the source of truth (client validation mirrors,
never replaces); all shared UI from `packages/ui`; Conventional Commits; migration numbers assigned at
build time (next free number), not reserved here.

**Open carry-over (one):**

- **Org-trust positive detail render** (org verified seal + host-maintained line, `trust-panel.tsx`) —
  the branch is now live in prod, but the render still needs a real competition with an organizer to
  eyeball. Do this once the **first seeded listing** lands on the catalog (ties to the R1-17 content
  gate; prod has no seeded listings yet). Low-value visual spot-check, not build work.

_(Settled: **whole-row-click on admin tables** stays deferred — decision + rationale in
`architecture.md` §13a; **cover-upload AWS key rotation** done by the owner.)_

---

## Phase 2 — R2 schema/payload batch (don't build now)

### 8. Import → created-competition link — schema (additive)

Approving an import creates a competition but records no link. **Plan:** additive column
`import_record.created_competition_id uuid NULL`; stamp it in the import-approve service; expose in
the admin import-record response; render a "created listing" link on reviewed import detail/rows.
(Owner explicitly deferred 2026-07-13.)

### 9. Card-level "Date TBD" label — search projection

Detail pages show "Deadline · TBD" (shipped); cards show nothing for TBD-only competitions. **Plan:**
the search projection adds a `deadline_tbd` boolean (`EXISTS (… kd.type IN (REG_CLOSE,
SUBMISSION_DUE) AND kd.starts_at IS NULL)` when `next_deadline IS NULL`) → carry through
`CompetitionSearchService.Item` → `CompetitionSummary.deadlineTbd` → `toCardData` maps a quiet
`deadlineLabel: 'Date TBD'`. Pairs with R2-10 (popularity sort touches the same native SQL +
payload). Interacts with the "Bragging rights" prize fallback only in the footer layout (both render).

### 10. Listing-health v2 checks — admin payload

The v1 checklist omits two checks because the admin edition-list payload carries no
key-date/region aggregates (no-new-fetches rule). **Plan:** add a small summary to the edition list
response (`hasDeadline: REG_CLOSE|SUBMISSION_DUE dated-or-TBD exists`, `regionCount`) via one
grouped query each; add the two checks in `lib/listing-health.ts`; then the deferred list-page
health column becomes possible (same aggregates).

### 11. Retire the vestigial verification write paths — rides R2-7 (RBAC)

Competition/edition `setVerification` endpoints exist but nothing calls them; the columns are held
at `CURATED` (domain-model §3f). **Plan:** when R2-7 lands real RBAC (and the claim flow formalizes
org-ladder writes, DQ11): remove the dead endpoints + request-DTO field; add a code-level assert
that competition/edition `verification_state` stays `CURATED` on every write path. Columns stay
(additive-only).

---

## Phase 3 — Host Tools, lifecycle machine & structure (don't build now)

_Both items are **design-gated at Gate A** — deliberately not planned deeper here (don't harden
early; the recorded target models are the plan)._

### 13. Competition structure — Edition → Stage → Round (H24/H25)

An R1 `Edition` carries a single date/fee set and `delivery` is competition-level, so a tiered
competition can't vary deadlines/costs/delivery per level. **Target model** (domain-model **§8b** +
glossary): annual cycle = **Edition** (one per year); each per-place level-instance = **Stage**
(owns dates/cost/registration/region, linked by `advances_to`); **Round** = sequential phase within
a Stage. Built by registry **H24/H25** at Phase 3, designed at Gate A. **R1 interim:** one running =
one `Edition` + per-level milestones as `KeyDate`s (typed key dates make this practical); tier
structure in prose/FAQ; defaults with a "select your region for specifics" disclaimer. **Do not**
hand-model tiers as separate Editions at R1.

### 14. Listing-status state machine + host publish controls — deferred from §8a

Deferred 2026-07-14 (real driver — self-serve hosts — is Phase 3; R1 is covered by archive/restore +
the readiness gate). **Plan sketch (full design: domain-model §8a):** additive migration (next free
number) adding `listing_status` (`DRAFT|PUBLISHED|UNLISTED`, plus `IN_REVIEW`) with
`PUBLISHED` backfill; Publish / Unlist / Re-list admin actions + status badges + "Save as draft";
the §8a seams — **IN_REVIEW / DQ12** pre-publication review (an edit keeps the live version public
while re-reviewed), **`visibility`** (public / link-only / invite-only, H48), **`list_at`**
scheduled listing. **Also lands here: the approval stamp** — `approved_at`/`approved_by` (additive
pair; owner deferred 2026-07-15), auto-stamped on admin create + import approve (`approved_by` null
until RBAC R2-7); the DQ12 review outcome writes it in Phase 3. Additive throughout — re-composes
cleanly onto the readiness gate.
