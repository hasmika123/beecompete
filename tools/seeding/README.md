# S3 — AI-assisted extraction pipeline v0

A standalone command-line tool that turns a competition's **official web page** into a validated
BeeCompete catalog record and drops it into the **R1-3 import-review queue** for a human curator to
approve (that review is **S4**). This is the seeding tooling from `docs/phase-1-plan.md` → "Data
seeding & catalog readiness", task **S3**.

> **v0 scope:** correctness and a clean, testable shape over breadth. It extracts the **Competition
> Spine + category `attributes`** only. Editions, key dates, and resources are added later by
> curators (separate admin endpoints). It never publishes anything — everything lands **PENDING**.

## Why it lives here (and not in the workspace)

`tools/seeding/` is intentionally **not** a pnpm-workspace member and is **not** wired into Turbo.
CI path-filters on `apps/**` and `packages/**`; keeping this out of those build graphs means it can
never destabilize the web/api pipelines. It has its own `package.json` and local `node_modules`.

## Pipeline

```
  --input URL ─┐
               ├─▶ fetch ──▶ extract (LLM) ──▶ validate ──▶ score ──▶ submit ──▶ R1-3 import queue
  --input .html┘   robots     Spine + attrs     schema +    0..1     POST         (PENDING)
  --batch .csv     UA/timeout  (facts only)      spine       conf    X-Admin-Token       │
                                                  sanity                                  ▼
                                                                            S4: human review/approve
```

1. **fetch** (`src/fetch.ts`) — GET the page with a descriptive User-Agent and a timeout, after a
   **basic robots.txt** check (honours a matching `Disallow`). HTML is distilled to plain text.
   A local `.html` path is read directly (the offline/fixture path — no network).
2. **extract** (`src/extract.ts`, `src/prompt.ts`) — an LLM maps the page text to the Spine +
   `attributes`. The system prompt encodes two hard rules: **facts only** (dates/fees/eligibility/
   format — never marketing prose) and **no `description`** (a copyrightable blurb is curator work
   at S4; the field is forced to `null`). The model returns strict JSON with a self-confidence and
   reviewer notes.
3. **validate** (`src/validate.ts`) — two gates: the `attributes` bag against the **correct Category
   Template JSON Schema** (draft 2020-12, mirrored from seed `0005` in `src/categories.ts`), plus
   **Spine sanity**: required fields, enum tokens, **grade encoding** (Pre-K −1, K 0, 1–12), and
   range checks. This mirrors the server so a passing record won't bounce on approve.
4. **score** (`src/confidence.ts`) — a transparent 0..1 confidence blending field completeness with
   the model's self-confidence, rounded to 2 dp.
5. **submit** (`src/submit.ts`) — `POST /api/v1/admin/import-records` with the `X-Admin-Token`
   header. The server stores it PENDING with `provenance.source = import` + our confidence.
   **Validation is re-run server-side on approve**, not at ingress — garbage may enter the queue,
   only reviewed data leaves it.

## Setup

```bash
cd tools/seeding
npm install
cp .env.example .env   # fill in as needed
```

## Environment variables

| Var                       | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`       | LLM provider key. **Unset ⇒ offline mode** (stub extractor, for CI).    |
| `ANTHROPIC_MODEL`         | Model id (env-configured, never hardcoded). Default `claude-3-5-sonnet-latest`. |
| `BEECOMPETE_API_BASE`     | API base owning the import queue. Default `http://localhost:8080`.       |
| `ADMIN_API_TOKEN`         | Shared admin secret → `X-Admin-Token`. Required only to actually submit. |
| `SEEDING_USER_AGENT`      | Override the crawler UA (optional).                                      |
| `SEEDING_FETCH_TIMEOUT_MS`| Per-request timeout, default 15000 (optional).                          |

Secrets come from env only — nothing is committed.

## Running it

**Dry-run against the bundled fixture (offline, no key, no network, no POST):**

```bash
npm run dry-run
# or:
npx tsx src/index.ts --dry-run --input fixtures/sample-competition.html
```

**Dry-run a live page (uses the LLM if `ANTHROPIC_API_KEY` is set):**

```bash
npx tsx src/index.ts --dry-run --input https://example.org/some-competition
```

**Real submit into the import queue (needs `ADMIN_API_TOKEN` + a reachable API):**

```bash
npx tsx src/index.ts --input https://example.org/some-competition
```

**Batch** — a `.txt` of one URL per line, or a `.csv` with a URL column (`url` / `official_url`).
Does **not** hard-depend on `docs/seeding/master-index.csv` existing (S2 may not have run yet):

```bash
npx tsx src/index.ts --batch ./urls.txt --limit 25 --dry-run
```

Flags: `--input`, `--batch`, `--limit N`, `--dry-run` (never POSTs), `--offline` (force the stub
extractor even with a key), `--help`. Exit code is non-zero if any item was invalid or errored.

## Offline / CI mode

With no `ANTHROPIC_API_KEY` (or `--offline`), extraction uses a **stub backend** that reads a
sibling `<input>.expected.json` next to the input `.html`. That's how the fixture and tests run with
no network and no key — the fetch/transform/validate/score path is fully exercised. See
`fixtures/sample-competition.html` + `.expected.json`.

## Tests

```bash
npm test        # node:test via tsx
npm run typecheck
```

`test/validate.test.ts` covers: a good extracted record passes schema + Spine validation; a bad one
fails (grade 13 out of range, unknown enum token, unknown evaluation token, an `attributes` type
that violates the category template); permissive templates accept extra keys; and `normalize`
resolves `categorySlug → categoryId` and nulls `description`. `test/fetch.test.ts` covers the
HTML-to-text distiller, the robots evaluator, and the CSV URL reader.

## Confidence scoring

`scoreConfidence` returns a 0..1 value (2 dp, the server stores a `BigDecimal` 0.00–1.00). It blends
**completeness** (weighted count of populated high-signal Spine fields — name/slug/category weigh
most) with the **model's self-reported confidence**. It's a triage signal for the S4 queue
(curators work low-confidence rows first) — **not** a correctness guarantee.

## How records flow into the R1-3 queue → S4 handoff

- A submit is a `POST /api/v1/admin/import-records` → a PENDING `import_record` row (payload +
  sourceUrl + confidence), stamped nothing yet.
- A curator opens the `/admin` import-review UI (built in R1-3), sees the payload and confidence,
  **edits then approves** (or rejects). On approve the server runs Bean Validation + the
  category-template attributes check and creates the real Competition with
  `provenance.source = import` and this pipeline's confidence.
- **Curators write our own `description`.** This tool deliberately leaves it `null` — facts aren't
  copyrightable, prose is. Extracted facts are a scaffold, not publishable copy.

## v0 limitations (follow-ups)

- **robots.txt** handling is best-effort (matching `Disallow`/`Allow` longest-prefix), not a full
  RFC 9309 parser; there's **no crawl-delay / rate limiting** yet. Be gentle with batches.
- **HTML→text** is a regex distiller, not a DOM/readability extractor; JS-rendered pages won't
  yield text (v0 fetches static HTML only).
- **Single-page** extraction — no multi-page crawl/merge (rules + FAQ + dates pages) yet.
- **No dedupe** against existing competitions (slug collisions surface as a 409 on approve).
- **Category templates are mirrored** from seed `0005` in `src/categories.ts`; if a template is
  edited via the admin tool, refresh that file. The server re-validates on approve regardless.
- **No CI job** for this tool in this PR (kept out of CI to avoid destabilizing the web/api
  pipelines). A **follow-up** could add a separate workflow, path-filtered on `tools/seeding/**`,
  running `npm ci && npm run typecheck && npm test` — the offline stub makes it network/key-free.
