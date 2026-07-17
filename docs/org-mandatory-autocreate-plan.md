# Plan — mandatory Organization + resolve-or-create on the import path

> **Status: BUILT (2026-07-16, local).** Owner decisions locked 2026-07-16: (a) **conservative
> exact-match reuse + flag near-duplicates** for the curator (no fuzzy auto-merge); (b)
> **`unknown`-organizer rows are flagged for manual assignment** (never a placeholder org). Orgs
> auto-created this way are **CURATED / unclaimed** — no verification work in R1. Shipped as **one
> full-loop change** (schema): migration `0012`, `CompetitionRequest` + `resolveOrganizer`, the
> seeding tool's `organizerName`, the import-review org panel + edit-form requirement, and the test
> fixtures. API suite green (49/49); seeding tests green (32/32). As-built: `domain-model.md` §3b,
> `architecture.md` §13a, `tools/seeding/README.md`, `CLAUDE.md`. **Migration note:** the migration
> uses `0012` (not `0011` as sketched below — `0011-landing-value-prop` already shipped).

## Goal

1. `Competition.organizer` becomes **mandatory** (DB `NOT NULL`, request-level rule, UI).
2. The **S4 approve path can create an Organization on the fly**: the seeding pipeline sends an
   `organizerName` string; the server reuses an existing org on an exact (normalized) name match,
   otherwise creates one — so seeding 200+ competitions never requires pre-creating orgs by hand.
3. Near-duplicate org names and missing organizers become **explicit curator flags**, not silent
   data quality drift.

## What already exists (verified in code, 2026-07-16)

| Seam | Where | State |
|---|---|---|
| Org lookup-by-name for import dedup | `OrganizationRepository.findByNameIgnoreCase` | **Already built** (comment says it's for this feature) |
| Near-match query | `OrganizationRepository.findByNameContainingIgnoreCase` | Already built (admin list search) |
| Single competition write path | `CompetitionCurationService.create/update` → `resolveOrganizer(UUID)` | Both admin CRUD **and** import-approve flow through it; combined create (`ListingCurationService`) composes it |
| Admin create form requires organizer | `apps/web/src/components/admin/competition-form.tsx` (completion ring `orgChosen`, `ADD_ORG` sentinel → `/admin/organizations/new` in a new tab) | **Create mode already requires it**; edit mode still offers "— none —" |
| Org defaults | `Organization` entity | `verificationState` defaults to `CURATED` — exactly the "unclaimed, unverified" R1 state |
| Unknown-prop tolerance on approve | `ImportQueueController.approve` uses Boot's default `ObjectMapper` (`FAIL_ON_UNKNOWN_PROPERTIES` off) | Old queued payloads without the new field keep parsing |

So the real work concentrates in: **one migration, `CompetitionRequest`, `resolveOrganizer`, the
seeding tool's payload, the import-review UI, and test fixtures.**

---

## 1. Schema — Liquibase `0011` (additive)

`apps/api/src/main/resources/db/changelog/changes/0011-organizer-mandatory.yaml`

- changeSet 1: **precondition** `SELECT count(*) FROM competition WHERE organizer_org_id IS NULL`
  = 0, `onFail: HALT` with a clear message. (Catalog has no live listings; staging/prod may hold a
  few hand-made test rows — the owner assigns or deletes them *before* deploying. Never backfill
  with a placeholder org — decision (b).)
- changeSet 2: `addNotNullConstraint` on `competition.organizer_org_id`.
- No new columns. No unique index on `organization.name` — R2 will legitimately hold same-named
  schools; the create race is acceptable for a single-curator R1 (documented below).

Entity: `Competition.organizer` → `@ManyToOne(optional = false)` + `@JoinColumn(nullable = false)`.
(`ddl-auto: validate` will then enforce migration/entity agreement on boot.)

## 2. API — `CompetitionRequest` + resolve-or-create

### `CompetitionRequest` (record — **arity changes**, see Tests)

Add two components:

```java
UUID organizerOrgId,            // unchanged position, still no @NotNull
@Size(max = 300) String organizerName,   // NEW: resolve-or-create by name
Boolean confirmNewOrganizer,    // NEW: curator override for the near-match guard
```

```java
@AssertTrue(message = "organizer is required: pass organizerOrgId or organizerName")
public boolean isOrganizerPresent() {
    return organizerOrgId != null || (organizerName != null && !organizerName.isBlank());
}
```

Putting `confirmNewOrganizer` **inside the request** (not a query param, not a new service
parameter) means zero signature churn: `create(request, stamp)` keeps its shape for all three
callers (admin CRUD, import approve, `ListingCurationService`).

### `CompetitionCurationService.resolveOrganizer` — replace with:

```java
private Organization resolveOrganizer(CompetitionRequest request, Provenance stamp) {
    if (request.organizerOrgId() != null) {
        return organizations.findById(request.organizerOrgId())
            .orElseThrow(...422 "unknown organizer org");     // current behavior, unchanged
    }
    String name = normalize(request.organizerName());          // trim + collapse inner whitespace
    Organization exact = organizations.findByNameIgnoreCase(name).orElse(null);
    if (exact != null) {
        if (exact.getArchivedAt() != null) {
            throw ...422 "organizer name matches an ARCHIVED organization (<id>) — restore it or pick another";
        }
        return exact;                                          // decision (a): exact match → reuse
    }
    List<Organization> near = organizations
        .findByNameContainingIgnoreCase(name, PageRequest.of(0, 5)).getContent();
    if (!near.isEmpty() && !Boolean.TRUE.equals(request.confirmNewOrganizer())) {
        throw ...422 "no exact organizer match for '<name>' but similar organizations exist: "
            + "<id — name> list. Set organizerOrgId to reuse one, or confirmNewOrganizer=true to create new.";
    }
    Organization created = new Organization(name, OrganizationType.HOST);
    created.setDomain(registrableHost(request.officialUrl()));  // e.g. "maa.org"; null-safe
    created.setProvenance(stamp);                               // same stamp as the competition
    return organizations.save(created);                         // verificationState defaults CURATED
}
```

Called from `apply(...)` as `resolveOrganizer(request, stamp)` (it needs the stamp now).

Notes / edge decisions:
- **Near-match = containment either way is NOT attempted** — only `findByNameContainingIgnoreCase`
  (query ⊂ existing). "MAA" vs "Mathematical Association of America" will *not* be caught; accepted
  limitation of decision (a), documented for curators. A wrong merge is worse than a duplicate.
- **`unknown` organizer path (decision b):** the seeding tool never sends
  `organizerName: "unknown"` (see §3); a payload with neither id nor name fails
  `isOrganizerPresent` at approve → the curator assigns an org via edit-then-approve. That IS the
  manual-assignment flag — no new mechanism needed.
- **Race:** two concurrent approves with the same new name can create two orgs. Single-curator R1;
  the near-match guard surfaces it on the next approve; merge is a manual admin action. Recorded,
  not solved.
- `update(...)` uses the same resolver — editing now also requires an organizer (matches the DB).

### `ImportQueueController`

No code change needed (`convertValue` binds the new fields; Bean Validation runs the new
`@AssertTrue`). **Improve the 422 texts only if needed** — the resolver's messages already carry
the candidate list; verify `ApiExceptionHandler` passes reasons through (it does — R1-3).

## 3. Seeding tool (`tools/seeding`)

- `src/types.ts` — `CompetitionPayload` gains `organizerName?: string | null`. (Do **not** add
  `confirmNewOrganizer` — the pipeline never overrides the guard; only a human curator does.)
- `src/prompt.ts` — payload spec gains:
  `organizerName (string|null): the organization that RUNS the competition, verbatim proper noun
  from the page (e.g. "Mathematical Association of America"); null if the page doesn't state it.`
  The S2 `organizer` hint already flows in via the hints block (built 2026-07-16).
- `src/extract.ts` `normalize` — `organizerName: sanitizeIfString(rest.organizerName)`; **never**
  copy the hint into the payload when the model returns null (hints are unverified — decision (b):
  a page that doesn't state its organizer stays null and gets flagged).
- `src/hints.ts` — add to `compareHints`: case-insensitive, whitespace-collapsed compare of
  extracted `organizerName` vs the `organizer` hint → warning `organizer mismatch: index hint "…"
  vs extracted "…" — verify`. Plus in `pipeline.ts`: if `organizerName` is null →
  warning `no organizer extracted — approve will require manual org assignment`.
- `src/confidence.ts` — add `organizerName` to the completeness weights (low weight; presence
  signal only).
- Tests: `submit.test.ts` **contract test** must add `organizerName` to the asserted field set;
  `validate.test.ts` hint-mismatch case; fixture `.expected.json` gains the field.

## 4. Web (`apps/web`)

- `components/admin/competition-form.tsx` — **edit mode**: drop the `'— none —'` option and add
  `organizer` to the edit-mode `requiredFields` (create mode already requires it). The `ADD_ORG`
  new-tab flow stays as-is.
- `app/admin/competitions/actions.ts` — unchanged shape (`organizerOrgId` string); server rejects
  empty now.
- `app/admin/import-records/[id]/page.tsx` (review UI) — the meaningful UX work:
  1. Show the payload's `organizerName` prominently.
  2. Server-side fetch `GET /api/v1/admin/organizations?query=<organizerName>` and render a
     **"Possible existing organizations"** panel: exact match → "will be reused ✓"; near matches →
     pick-one buttons that write the chosen `organizerOrgId` into the editable payload (and clear
     `organizerName`); none → "a new organization '<name>' will be created (CURATED)".
  3. A **"Create as new organization anyway"** checkbox that sets `confirmNewOrganizer: true` in
     the payload override — the curator-facing face of the server guard.
  4. Missing organizer (null name) → a warning banner: "No organizer — assign one before approving"
     with the same org-search picker.
- `lib/admin-types.ts` — payload type gains `organizerName?: string | null`.

## 5. Tests to update (enumerated)

API (compile breaks from the record arity change + new NOT NULL):
- `curation/ValidationRulesTest.java` — direct `CompetitionRequest(...)` constructor call(s).
- `CatalogPersistenceTest.java` — direct `new Competition(...)` persist; needs an org.
- JSON-body creators (add `"organizerName": "<Test Org>"` — also *exercises* resolve-or-create):
  `AdminApiIntegrationTest`, `CatalogSearchIntegrationTest`, `CatalogPublicApiIntegrationTest`,
  `CorrectionsIntegrationTest` (and any landing/sitemap test that creates competitions).
- **New coverage:** exact-name reuse (two competitions, same `organizerName` → one org);
  near-match 422 lists candidates; `confirmNewOrganizer: true` creates despite near-match;
  archived-exact-match 422; missing organizer 422 (`isOrganizerPresent`); auto-created org is
  `CURATED`/`HOST` with domain from `officialUrl`.

Tool: contract test + hints tests (§3). Web: `listing-health` unchanged (organizer check exists).

## 6. Docs to touch when built

- `docs/domain-model.md` §3b (Organization) — record the mandatory rule + resolve-or-create +
  CURATED-on-auto-create; §8a readiness note unaffected (organizer now guaranteed).
- `docs/architecture.md` §13a — as-built paragraph.
- `tools/seeding/README.md` — pipeline step 2/5 + the S4 handoff section (organizer flags).
- `CLAUDE.md` current-state line.

## 7. Build order (single branch, `feat/org-mandatory-autocreate`)

1. API: `CompetitionRequest` fields + `resolveOrganizer` rewrite + entity `optional=false`.
2. Migration `0011` (precondition + NOT NULL). Boot-validate against a fresh local DB.
3. Fix all API tests; add the new §5 coverage. Full suite green.
4. Seeding tool changes + tests.
5. Web: edit-form requirement + import-review org panel.
6. Docs. Then, before deploy: clean any NULL-organizer test rows in staging/prod
   (`SELECT id, name FROM competition WHERE organizer_org_id IS NULL`).

## Out of scope (explicitly)

- Fuzzy/acronym org matching or auto-merge (decision (a) — curator-only).
- Org verification workflows (R1 keeps everything CURATED; claim/verify is the existing ladder).
- Unique index on `organization.name` (R2 schools may share names).
- Backfilling or placeholder orgs for `unknown` organizers (decision (b)).
