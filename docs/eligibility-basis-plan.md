# Eligibility basis — implementation plan (2026-08-28)

**Status:** approved 2026-08-28. **PR 2 (display) + PR 4 (extractor) are BUILT**, and the minimum of
PR 1 they depend on came with them — the column, its backfill, API exposure, and the curator
selector. **PR 3 (Age facet + search) is NOT built**, so both filter axes still behave as they did:
the grade facet is the only one, and a null grade range still matches every grade band.
**Owner decisions taken 2026-08-28:** explicit basis column · Age facet added alongside Grade ·
"Not stated" when no eligibility is on record.

---

## 1. The problem

The catalog stores a grade range and an age range (domain-model **Q2**), but nothing records
**which one the organizer actually stated**. Every summary surface therefore renders grade as fact,
and three things go wrong.

**(a) We display derived grade ranges as stated rules.** The seeding extractor is told to "convert
age/grade statements carefully" (`tools/seeding/src/prompt.ts`), and it converts ages *into* grades.
All 8 age-carrying rows in the import queue also carry grades:

| Listing | stored grades | stored ages | what the organizer actually states |
|---|---|---|---|
| Breakthrough Junior Challenge | 7–12 | 13–18 | **ages only** |
| Diamond Challenge | 9–12 | 14–18 | **ages only** |
| FIRST LEGO League Challenge | 4–8 | 8–16 | **ages only** |
| FIRST Robotics Competition | 9–12 | 14–18 | ages (grades approximate) |
| FIRST Tech Challenge | 7–12 | 12–18 | ages (grades approximate) |
| Breakthrough / Arts / Scholastic | 7–12, 10–12 | 13–18, 15–18, 13+ | mixed; Scholastic states both |

Breakthrough Junior Challenge's rule is "ages 13–18". We publish **"Grades 7–12"** on the card, the
At-a-glance strip and the grade facet. A 12-year-old in grade 7 reads eligible and is not; a
19-year-old in grade 12 reads eligible and is not. The mapping is lossy in principle — the extractor
turned age 18 into grade 12, dropping grade 13 — so a derived range can never carry a stated rule's
authority. **This is a minors-facing accuracy claim, which this project treats as first-class.**

**(b) Null eligibility reads as "everyone".** `CompetitionSearchService` filters with
`c.min_grade IS NULL OR …`, so a listing with no grade range matches *every* grade filter. Verified
against a live API:

```
GET /api/v1/competitions?minGrade=1&maxGrade=1   →   amc-10, fable-test-open
```

AMC 10 is returned to a parent filtering **Elementary / grade 1**. Neither grades nor ages are
required at curation (`competition-form.tsx` `requiredFields`), so **12 of 56** queued extractions
carry no eligibility at all — and each one currently asserts **"All grades"** on its Overview strip,
a claim nobody verified.

**(c) Age is invisible outside one tab.** The Eligibility tab renders both rows correctly
(`key-facts.tsx`). The card badge, the At-a-glance strip and the whole filter panel are grade-only.

## 2. The shape of the fix

Separate the two jobs the grade range is currently doing at once:

- **Stated eligibility** — what the organizer says. Drives *display*. Must never be derived.
- **Filterable eligibility** — a normalized range on both axes. Drives *search*. May be derived.

`eligibility_basis` says which axis is stated; the other axis is then understood to be derived, and
is labeled as such wherever it appears.

| basis | grades | ages | card / strip shows |
|---|---|---|---|
| `GRADE` | stated | derived | `Grades 9–12` |
| `AGE` | derived | stated | `Ages 13–18` |
| `BOTH` | stated | stated | `Grades 7–12 · Ages 13+` |
| `OPEN` | — | — | `Open to all ages` |
| `null` (legacy/unknown) | — | — | `Not stated` |

Both numeric pairs stay populated wherever we can derive them, so **both facets can filter every
listing** regardless of basis. Mapping: `grade = age − 5`, clamped to the ladder (Pre-K −1 … Grad
17) and to ages 0–99. It lives in one server-side helper and is applied on save, never in the UI.

**⚠ Assumption needing a nod (§5.1):** a listing with `basis = null` matches **no** grade or age
filter. A filter is a question, and a listing we cannot answer for should not be asserted as a match.
This hides ~21% of the current queue from any filtered view until curators fill the gap — which is
the point, but it is a visible behavior change. Say so if you would rather they still appear.

## 3. Scope registered first (house rule: registry + glossary before code)

- **`docs/glossary.md`** — new term **Eligibility basis** (canonical name; values; the stated-vs-derived
  rule; "never present a derived range as a stated one").
- **`docs/domain-model.md` Q2** — Q2 is a *locked* question, so this is written as a **refinement,
  not a reversal**: grade remains the primary filter axis and both ranges are still stored. What is
  added is the basis column and the stated/derived distinction. Q2 already anticipates the age
  filter ("age-gated comps filter on age") — it assumed a logged-in DOB, and R1 has no accounts, so
  the visitor supplies the age instead.
- **`docs/feature-registry.md` M3** — the facet list is the scope contract and does not name age.
  Add **age** to M3's list with a Rev note. No new registry ID; this is M3 + X9 depth, not a new feature.
- **`docs/page-blueprints.md`** — decision **#99**: card/strip render the stated axis · "Not stated"
  replaces the "All grades" fallback · Age facet added. Blueprint **#10** fixes facet order
  (Grade → Category → State/Region → Deadline → Entry fee → Format → Delivery); **Age goes directly
  under Grade**, since it answers the same question. #10 gets a superseding note.

## 4. Build order (4 PRs, each independently shippable)

### PR 1 — `feat/ELIG-1-basis-column` (schema + curation) — **BUILT except derivation**
- `0023-eligibility-basis.yaml`: add `competition.eligibility_basis VARCHAR(10)`, additive, no CHECK
  (house style — matches `scope_level`).
- Backfill in the same changeset: grades only → `GRADE`, ages only → `AGE`, both → `BOTH`,
  neither → `NULL`.
  **⚠ The 8 rows in §1(a) backfill to `BOTH` and are wrong** — their grades are derived, not stated.
  They need a curator pass; PR 1 ships a `docs/seeding/` note listing them by name rather than
  guessing.
- `Competition` entity · `CompetitionRequest` (validated enum) · `CompetitionAdminController` ·
  `CorrectionFields` whitelist (so the public correction form can target it).
- `EligibilityDerivation` helper in the catalog module + applied in `CompetitionCurationService`, so
  the derived pair is populated on every write. Server-side only. **Deferred to PR 3** — nothing
  reads a derived range until the search work does, and generating them early would put uncurated
  numbers in the stated columns.
- Admin form: basis selector on the Eligibility step; the derived pair renders read-only and labeled
  "derived — used for filtering, not shown as a rule".

### PR 2 — `feat/ELIG-2-stated-axis-display` (the accuracy fix) — **BUILT**
- `eligibilityLabel(basis, grades, ages)` in `catalog-display.ts` — the single function every summary
  surface calls.
- `CompetitionCard`: `gradeLabel` prop → `eligibilityLabel` (shared UI, `packages/ui`; badge slot is
  fixed-height and `shrink-0`, and "Ages 13–18" is within the width "Grades 9–12" already occupies).
- At-a-glance: label and value follow the basis; **"All grades" fallback retired** → "Not stated".
  Strip columns are ratio-pinned by #117, so the value must stay one line — it does.
- Eligibility tab (`key-facts.tsx`): keep both rows, label the derived one
  ("Approx. grades 7–12 — the organizer states ages").
- Structured data: **no change needed** — checked at build time, the `Event` JSON-LD emits no
  eligibility/audience field at all, so there was nothing carrying the wrong claim. If an
  `audience` / `typicalAgeRange` is ever added, it must read `eligibilityLabel` like the rest.
- OG share image: **also fixed** (not in the original plan). It carried its own copy of the
  `?? 'All grades'` fallback, on the most context-free surface we publish.

### PR 3 — `feat/ELIG-3-age-facet` (search) — **NOT BUILT (next)**
- `CompetitionSearchService.Criteria` gains `minAge`/`maxAge` + overlap predicates mirroring grade;
  `null`-basis exclusion per §5.1.
- **No age facet counts** — blueprint #10 puts counts on Grade + Category only, so this stays one
  filter, not a counted facet.
- `filter-panel.tsx`: Age facet directly under Grade, From/To selects mirroring the grade pair.
- `marketplace-params.ts`: params, active chips, `RELAX_ORDER` entry (age relaxes just above grade).
- `CatalogPublicController` params + API contract note in `architecture.md`.

### PR 4 — `feat/ELIG-4-extractor-basis` (must precede the bulk seeding run) — **BUILT**
- `prompt.ts`: stop converting ages into grades. Record what the page states; emit
  `eligibilityBasis`. This is the change that stops the problem reproducing.
- `types.ts` · `validate.ts` · web `import-seed.ts` (tolerate the field's absence, same as the
  retired-`summary` handling).
- **Timing:** cheapest before the 200-competition content gate. Landing it after the bulk run means
  re-curating invented grade ranges on up to 200 listings by hand.

## 5. Open items

1. **`basis = null` excluded from filtered results** — §2. Stated as an assumption; overrule if you
   disagree.
2. **The 8 mislabeled rows** — curator pass, tracked in `docs/seeding/`. Not automatable: only the
   organizer's page says which axis is real.
3. **Required-at-curation?** Not in this plan. Making grades-or-ages a readiness requirement would
   block ~21% of the import queue; it is a separate call once the display stops over-claiming.

## 6. Tests

- API: search overlap on both axes · backfill correctness · `null`-basis exclusion · validation.
- Web: `eligibilityLabel` across all five basis states · at-a-glance and card rendering ·
  `marketplace-params` round-trip · `import-seed` with and without the new field.
- No test currently asserts the string "Cost"/"Grades" on these surfaces, so nothing pre-existing
  breaks silently — the new ones are the guard.
