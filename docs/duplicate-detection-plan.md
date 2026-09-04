# Duplicate detection — implementation plan (2026-09-03)

**Status:** approved 2026-09-03 (all five decisions in §4 taken as recommended). **PR 1 BUILT
2026-09-03** (migration `0026`, `DuplicateDetectionService`, both gates, both `/duplicates`
lookups, the form panels, the queue flags, the seeding pre-check). **PR 2 (mark-as-duplicate +
redirect) follows.** Registers the Phase-1 slice of **DQ4** ("Duplicate competition detection &
merging", `feature-registry.md`): detection + hard gates now, because several people are seeding
at once and the catalog is about to pass 200 listings. The content-merge half of DQ4 (moving
editions/resources/follows between listings) stays Phase 2 (`sweep-remediation-plan.md` §20).

---

## 1. The problem

Today the only duplicate guard on a Competition is the **slug** (`uq_competition_slug`), and the
slug is *derived from the name* on the curated path. So:

| Path | What happens with a repeat | Result |
|---|---|---|
| Admin create form, same name | `slugFor()` silently stores `mathcounts-2` | **duplicate, no warning** |
| Admin create form, same competition under a different spelling ("MATHCOUNTS" / "Mathcounts Competition Series") | different slug, no check | duplicate |
| Import approve, same slug | 409 + a red "slug taken" badge in the queue | caught — **only if the extractor derived the same slug** |
| Import approve, same URL / near-identical name | nothing | duplicate |
| Two people queue the same competition | two PENDING rows, no cross-reference | the second reviewer wastes time or approves a duplicate |
| `POST /admin/organizations` (direct org create) | no check at all | duplicate orgs |
| Organizer via a competition write | exact → reuse, similar → 422 unless confirmed | **the one path that works** — and the model for the rest |

Nothing consults `official_url`, even though the seeding index dedups its own input by URL and a
URL is the strongest identity signal a competition page has. And nothing survives a race: two
curators creating the same listing at once both pass every application-level check.

## 2. The shape of the fix

Three layers, from hard to soft, mirroring the organizer resolver that already exists:

1. **Identity keys, computed in the database.** Two Postgres functions, `catalog_name_key(text)`
   and `catalog_url_key(text)`, normalize a name and a URL into comparable keys. They back
   **stored generated columns** on `competition`, `import_record` (from the JSONB payload) and
   `organization`, so every row — API write, migration, raw seed SQL — carries the same key with
   no application code, exactly like the `0007` search vector. Java never re-implements the
   normalization: lookups pass the raw value and let SQL key it (`WHERE name_key =
   catalog_name_key(:name)`), so the two sides cannot drift.

   - `catalog_name_key`: lowercase → every run of non-alphanumerics becomes one space → trim
     → `NULL` if empty. "MATHCOUNTS®", "Mathcounts", "MATH-COUNTS" all key to `mathcounts`.
     Unicode letters survive (`[[:alnum:]]`, not `[a-z0-9]`); accents are *not* folded (the
     `unaccent` extension is STABLE, so it cannot feed a generated column).
   - `catalog_url_key`: lowercase + trim → drop the scheme → drop a leading `www.` → drop the
     query/fragment → drop trailing slashes → `NULL` if empty. `https://www.maa.org/amc/`,
     `http://maa.org/amc?x=1`, `maa.org/amc` all key to `maa.org/amc`.

2. **A hard rule with a DB backstop.** Two *live* (non-archived) competitions may not share a
   `name_key`: partial unique index `uq_competition_name_key_live`. Two live listings with the
   same normalized name are indistinguishable on a card whatever else differs, so the rule is a
   UX rule as much as a data rule — the fix is always to rename one ("National Mathematical
   Olympiad (India)"). The service says so with a friendly 409 naming the other listing before
   the index ever fires; the index is what makes a concurrent-create race lose instead of
   succeed. **No** unique index on `url_key` (umbrella programs share a page — see
   `docs/seeding/README.md` "Intentional multi-row programs") and **none** on
   `organization.name_key` (the `0012` decision stands: R2 will hold same-named schools).

3. **Soft signals, refused unless confirmed.** A URL match, a similar name (`pg_trgm` whole-string
   similarity ≥ 0.45, or containment either way), or an exact match against an *archived*
   listing is a 422 listing the candidates — unless the request carries
   `confirmNotDuplicate: true`, the same override shape as `confirmNewOrganizer`. Same rule,
   same flag, for organizations (name similar / same `domain`).

One service computes all of it — **`DuplicateDetectionService`** — and serves the write gates,
two admin lookup endpoints (so the forms warn *before* submit), the import queue's flags, and
the seeding tool's pre-check.

### Glossary additions (`docs/glossary.md`, "System, money & data")

| Term | Definition |
|---|---|
| **Duplicate candidate** | An existing Competition (or Organization, or PENDING import record) that a detection rule says may be the same thing as the one being written. Carries its **match reasons**. |
| **Match reason** | Why something is a candidate: `NAME_EXACT`, `URL_EXACT`, `NAME_SIMILAR`, `SLUG_TAKEN` (competitions); `NAME_EXACT`, `DOMAIN_EXACT`, `NAME_SIMILAR` (organizations). |
| **Name key / URL key** | The normalized, DB-computed identity strings (`name_key`, `url_key`) two rows are compared on. Never displayed. |
| **Pending twin** | A PENDING import record whose name/URL keys match the one being reviewed — "someone already queued this". |
| **Canonical listing** | The one Competition that survives when duplicates are found. A merged duplicate is archived and points at it (`duplicate_of_competition_id`, PR 2). |

## 3. Scope

### PR 1 — keys, detection, gates, UI, seeding pre-check (the "prevent it now" slice)

**Migration `0026-duplicate-keys.yaml`** (three changesets, additive):

1. The two SQL functions (`IMMUTABLE PARALLEL SAFE`). ⚠ A literal `?` in a changeset is eaten
   as a JDBC bind placeholder (see the `0007`-era memory note) — the query-string regex is
   written `E'[\x3f#].*$'`, never `[?#]`.
2. Generated columns + indexes: `competition.name_key`, `competition.url_key`
   (`ix_competition_url_key`, partial `WHERE url_key IS NOT NULL`); `import_record.name_key` /
   `url_key` from `payload->>'name'` / `payload->>'officialUrl'` (indexes partial `WHERE status =
   'PENDING'`); `organization.name_key` (plain index) + `ix_organization_domain`.
3. `uq_competition_name_key_live` — with a **HALT precondition** listing any live rows that
   already collide (same pattern as `0012`): the owner renames or archives them before deploy;
   staging surfaces this first on the `main` push. The entities do **not** map the key columns
   (native-query-only, like `search_vector`).

**API (`apps/api`, catalog module):**

- `DuplicateDetectionService` (`catalog.curation`) — `findCompetition(name, officialUrl, slug,
  excludeCompetitionId, excludeImportRecordId)` → `{catalog: [candidate…], pending: [twin…]}`
  and `findOrganization(name, domain, excludeId)`. Candidates come from ONE native query per
  table (`CompetitionRepository.findDuplicateCandidates`, `ImportRecordRepository.findPendingTwins`,
  `OrganizationRepository.findDuplicateCandidates`) that returns the row plus boolean reason
  columns and the similarity score; reasons are assembled in Java. The similarity threshold is
  one documented constant. (`similarity()` does not use the trigram GIN index the way `%` does;
  at catalog scale — thousands of rows — that is irrelevant and the simpler predicate wins.)
- `CompetitionCurationService.create` / `update` gain `guardDuplicates(request, selfId)` before
  the slug step: live `NAME_EXACT` → **409** (never overridable, the index backs it); archived
  `NAME_EXACT`, `URL_EXACT`, `NAME_SIMILAR` → **422** listing candidates unless
  `request.confirmNotDuplicate()`. `update` runs it only when name or URL actually changed.
  `SLUG_TAKEN` keeps today's behavior (suffix on curated create, 409 on import/update).
  A `DataIntegrityViolationException` naming `uq_competition_name_key_live` (the race) maps to
  the same 409.
- `CompetitionRequest` + `OrganizationAdminController.OrganizationRequest` gain
  `Boolean confirmNotDuplicate`.
- Organizations: the resolver's containment check moves into the service (unchanged semantics,
  plus `DOMAIN_EXACT` as a similar-signal). Direct `POST/PUT /admin/organizations` gets the
  same gate: live `NAME_EXACT` → 409 pointing at the existing org; `DOMAIN_EXACT` /
  `NAME_SIMILAR` → 422 unless confirmed.
- New read endpoints: `GET /admin/competitions/duplicates?name&officialUrl&slug&excludeId`
  and `GET /admin/organizations/duplicates?name&domain&excludeId`.
- Import queue: `ImportRecordResponse.duplicateCompetitionId` becomes
  `duplicate: {competitionId, slug, name, reasons[]} | null` + `pendingTwins: n`. The list
  computes only the cheap bulk signals (name/url/slug keys, three `IN` queries per page — no
  trigram); `GET /{id}` and the ingest `POST` response run full detection. Ingest still
  **accepts** the record (the queue is lenient by design; re-extraction after a prompt fix is a
  real use) — it flags, and the seeding tool decides.

**Web (`apps/web`):**

- `admin-types.ts`: `MatchReason`, `DuplicateCandidate`, `PendingTwin`, `CompetitionDuplicates`,
  `OrganizationDuplicates`; `ImportRecord.duplicate` / `pendingTwins`.
- Server actions `findCompetitionDuplicates` / `findOrganizationDuplicates` (BFF → the new GETs).
- `competition-form.tsx` (shared by create, edit and import review): a debounced check on
  name / official-URL change renders a **"Possible duplicates"** panel — the same notice + card
  list the organizer resolver already uses (no new element type) — each candidate linking to
  its admin page with its reasons, plus the checkbox *"This is not a duplicate — create it
  anyway"* → hidden `confirmNotDuplicate` carried by `buildCompetitionBody`. Edit mode passes
  `excludeId`.
- Organization form (standalone page + the in-form modal): the same panel and checkbox.
- Import queue table: badge reads **already listed** (name/URL exact), **slug taken**, or
  **also pending ×N**; flagged rows can't be bulk-approved (checkbox disabled, "review
  individually") instead of today's "will fail" warning.
- Import review header: the candidates panel replaces the single slug warning.

**Seeding tool (`tools/seeding`):** before fetching/extracting an item, `checkKnown()` calls
`/admin/competitions/duplicates` with the source URL and the index-hint name; a live
`NAME_EXACT` / `URL_EXACT` catalog hit or a pending twin → outcome `skipped` with the match named
(saves the LLM call too). `--include-known` bypasses; the check is skipped when there is no token
(`--dry-run` offline still works). `docs/seeding/README.md` gets a short "known-listing
pre-check" section.

**Docs:** glossary rows above; `domain-model.md` §3a (`name_key`/`url_key`, the live-name
uniqueness rule, detection rules — and the organizer note updated to point at the service);
`feature-registry.md` DQ4 → "Phase 1 slice built 2026-09-03: detection + gates; merge = Phase 2";
`sweep-remediation-plan.md` gets the content-merge item.

### PR 2 — "mark as duplicate of" + redirect (the foundation for merging)

Duplicates *will* still slip through (different names, different URLs, human judgment). Today
the only remedy is archiving, which 404s a slug that may already be indexed. This PR adds the
minimal linkage so a found duplicate can be retired cleanly:

- Migration `0027`: `competition.duplicate_of_competition_id UUID NULL` self-FK + index +
  `CHECK (duplicate_of_competition_id <> id)`.
- `POST /admin/competitions/{id}/mark-duplicate {canonicalId}`: canonical must be live and not
  itself a duplicate (no chains); archives the row (featured slot removed, as archive does) and
  sets the link. `restore` clears it. `CompetitionResponse.duplicateOfCompetitionId`.
- Public: `GET /api/v1/competitions/{slug}/canonical` answers the canonical slug for a merged
  duplicate; `/c/[slug]` calls it on a 404 and issues a **permanent redirect**. The sitemap is
  unaffected (archived rows were already excluded).
- Admin detail: a "Merged into *X*" banner; the action lives beside Archive and picks the
  canonical through the existing Modal + list pattern fed by the admin search.
- **Out of scope (DQ4 Phase 2):** moving editions, resources, FAQs, follows or featured slots
  from the duplicate to the canonical.

## 4. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | Hard DB uniqueness on the normalized name of *live* competitions (rename to disambiguate; never overridable) | **Yes** — it is the only guard that survives two people creating the same listing at once, and same-named live listings are a card-level UX failure anyway. |
| D2 | Same official URL: warn + confirm, not block | **Yes** — umbrella programs (AMC 8/10/12, NSDA events, Scholastic Art vs Writing) legitimately share a page. |
| D3 | Ingest into the queue: flag, don't refuse; the seeding tool skips known listings by default | **Yes** — keeps re-extraction possible; the pipeline stops spending LLM calls on things already listed. |
| D4 | Build PR 2 (mark-duplicate + redirect) now, not at R2 | **Yes** — small, and without it every duplicate that slips through during seeding becomes a dead indexed URL. |
| D5 | Direct organization create gets the same gate (exact → 409, similar/domain → 422 unless confirmed) | **Yes** — it is the one org path with no check today. |

## 5. Tests

- **API (`AdminApiIntegrationTest` + new `DuplicateDetectionIntegrationTest`, Testcontainers):**
  key normalization cases (case / punctuation / ® / whitespace; URL scheme / `www.` / trailing
  slash / query); live exact name → 409 even with the flag; archived exact, URL exact, similar →
  422 without / 201 with the flag; update excludes itself and only re-checks on a name/URL
  change; import approve honors the flag, bulk approve reports the 422 per row; queue list
  flags + pending twins; ingest response carries the flag; both `/duplicates` endpoints;
  org direct-create gate; the unique index mapped to 409. PR 2: mark-duplicate happy path, no
  chains, restore clears, `/canonical` + the web redirect.
- **Web (vitest):** `competition-payload` carries `confirmNotDuplicate`; badge/eligibility logic
  for bulk selection.
- **Seeding (`tools/seeding` tests):** `checkKnown` skips on a catalog hit / pending twin, runs
  on none, is bypassed by `--include-known` and by a missing token.
- Existing test `derivedSlugCollisionsGetSuffixedOnCreateButStillConflictOnUpdate` changes: the
  same-name repeat it relies on is now a 409, so it moves to distinct names that share a slug
  ("Slug Clash" / "Slug-Clash!" no longer works either — they share a name key; use
  "Slug Clash" vs "Slug Clash 2" style pairs or a punctuation-only slug variant).
