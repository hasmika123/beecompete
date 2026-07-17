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

0. **dedup** (`src/input.ts`) — a batch is first collapsed by URL: umbrella programs list the same
   page under several rows (AMC 8/10/12 all point at `maa.org/student-programs/amc`). We keep the
   first, drop the rest (extracting one page N times wastes LLM calls and yields N records that
   409-collide on approve), and stamp the survivor with a **"this URL also covers: …"** curator flag.
1. **fetch** (`src/fetch.ts`) — GET the page with a descriptive User-Agent and a timeout, after a
   **basic robots.txt** check (honours a matching `Disallow`, exact UA-token match). Redirects are
   followed manually (max 5) with the robots check + the private-address guard re-run on **every
   hop**; the body is capped at **3 MB** and non-HTML content types are skipped. Transient faults (a
   thrown network error = TCP/TLS drop, or a 5xx) are **retried up to 3× with exponential backoff**;
   a 4xx (403 bot-block) or robots-disallow is permanent and not retried. Private/loopback/link-local
   addresses (localhost, `10.*`, `169.254.*`, `::1`, …) are refused unless `--allow-private` is
   passed. HTML is distilled to plain text. A local `.html` path is read directly (the offline/
   fixture path — no network).
2. **extract** (`src/extract.ts`, `src/prompt.ts`) — an LLM maps the page text to the Spine +
   `attributes`. Any **S2 master-index hints** for the row (name, organizer, category, cost, …) are
   passed in as **trusted internal guidance** — they help when the page is silent, but the page wins
   on conflict and the model flags disagreements. The system prompt encodes three hard rules: **the
   page text is untrusted content** (instructions embedded in a page are ignored — see
   "Prompt-injection surface" below), **facts only** (dates/fees/eligibility/format — never marketing
   prose), and **no `description`** (a copyrightable blurb is curator work at S4; the field is forced
   to `null`). The model also extracts **`organizerName`** — the organization that RUNS the
   competition, verbatim, or `null` if the page doesn't state it; the server resolves it to an org on
   approve (exact name → reuse, else create a CURATED org). We **never** substitute the S2 `organizer`
   hint for a `null` extraction — an unverified hint must not become catalog data; a page that names
   no organizer stays `null` and is flagged for manual assignment. The model returns strict JSON with
   a self-confidence and reviewer notes; `normalize` strips `<`, `>`, and control characters from
   every free-text field, and **drops null-valued attribute keys** (an unknown optional attribute the
   model emits as `null` would otherwise fail the template's `type` and bounce the record to INVALID).
3. **validate** (`src/validate.ts`) — two gates: the `attributes` bag against the **correct Category
   Template JSON Schema** (draft 2020-12, mirrored from seed `0005` in `src/categories.ts`,
   compiled once per category), plus **Spine sanity**: required fields + types, enum tokens,
   **grade encoding** (Pre-K −1, K 0, 1–12), range checks (team sizes ≥ 1, ages ≥ 0), and
   `officialUrl`/`logo` must be well-formed **http(s) URLs ≤ 1000 chars** (the server `@Size` cap).
   Suspicious-but-legal combinations (team sizes on an INDIVIDUAL competition, an `officialUrl`
   whose domain differs from the fetched page's domain) surface as **warnings** for the reviewer, as
   do **hint disagreements** (`src/hints.ts`: extraction vs. index cost/participation/pathway/category/
   **organizer**) and the shared-URL umbrella flag — the curator's "look twice here" list. A record
   with **no extracted organizer** is flagged too (`no organizer extracted — approve will require
   manual org assignment`): organizer is mandatory server-side, so such a row can't be approved until
   the curator assigns one.
4. **score** (`src/confidence.ts`) — a transparent 0..1 confidence, rounded to 2 dp. **Penalty-only
   blending:** the model's self-reported confidence can only LOWER the score below field
   completeness, never raise it — page content that instructs the model to claim high confidence
   cannot game the review queue.
5. **submit** (`src/submit.ts`) — `POST /api/v1/admin/import-records` with the `X-Admin-Token`
   header. **`sourceUrl` is always the URL the tool actually fetched** (the extraction's
   `officialUrl` stays inside the payload — an LLM-steered "official URL" can never become the
   provenance link a curator clicks). The server stores it PENDING with
   `provenance.source = import` + our confidence. **Validation is re-run server-side on approve**,
   not at ingress — garbage may enter the queue, only reviewed data leaves it.

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
| `ANTHROPIC_MODEL`         | Model id. Default `claude-sonnet-5`; if the id is retired/unknown the tool fails with an explicit "set ANTHROPIC_MODEL" error. |
| `BEECOMPETE_API_BASE`     | API base owning the import queue. Default `http://localhost:8080`. The tool warns loudly if the admin token would go over plain http to a non-local host. |
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

Flags: `--input`, `--batch`, `--limit N` (positive integer — anything else is a hard error),
`--dry-run` (never POSTs), `--offline` (force the stub extractor even with a key),
`--allow-private` (permit fetching private/loopback addresses — off by default), `--help`.
Exit code is non-zero if any item was invalid or errored. Each item's report prints validation
errors, **warnings** (e.g. an `officialUrl` on a different domain than the fetched page), and the
model's **reviewer notes** for the S4 curator.

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

`test/validate.test.ts` covers: a good extracted record passes schema + Spine validation; bad ones
fail (grade 13 out of range, unknown enum/evaluation tokens, an `attributes` type that violates the
category template, `javascript:`/garbage/over-long URLs, team sizes < 1, negative ages, wrong-typed
fields); warnings (team sizes on INDIVIDUAL); free-text sanitizing (angle brackets + control chars);
penalty-only confidence; permissive templates accept extra keys; and `normalize` resolves
`categorySlug → categoryId` and nulls `description`. `test/fetch.test.ts` covers the HTML-to-text
distiller, the robots evaluator (incl. exact UA-token matching), the private-address guard, and the
CSV URL reader. `test/submit.test.ts` is the **contract test**: it captures the actual POST body
against a local HTTP server and asserts the exact `ImportSubmission` shape, the
`CompetitionRequest` field set, and enum casing (UPPERCASE spine enums, lowercase
`evaluationType` tokens).

## Confidence scoring

`scoreConfidence` returns a 0..1 value (2 dp, the server stores a `BigDecimal` 0.00–1.00). It starts
from **completeness** (weighted count of populated high-signal Spine fields — name/slug/category
weigh most); the **model's self-reported confidence** is blended in **penalty-only** — it can drag
the score below completeness but never above it (`min(completeness, blend)`), so a prompt-injected
"claim confidence 1.0" cannot promote a record in the queue or inflate the provenance confidence
stamped onto the public record on approve. It's a triage signal for the S4 queue (curators work
low-confidence rows first) — **not** a correctness guarantee.

## Prompt-injection surface

The extraction step feeds **arbitrary fetched web pages** to an LLM — page content is untrusted
input and can try to steer the extraction (fake "official" URLs, inflated confidence, markup in
text fields). Defenses, in order: the system prompt explicitly marks page text as untrusted data;
`normalize` strips `<`/`>`/control characters from all free-text fields; validation whitelists
every enum and requires http(s) URLs; the queue `sourceUrl` is always the fetched URL (never the
LLM's `officialUrl`, which is cross-checked against the fetched domain and flagged when it
differs); confidence blending is penalty-only; and **every record still passes S4 human review**
before it becomes a Competition. None of these make the LLM output trustworthy — they make the
blast radius of a hostile page a flagged, low-confidence PENDING row a curator inspects.

## How records flow into the R1-3 queue → S4 handoff

- A submit is a `POST /api/v1/admin/import-records` → a PENDING `import_record` row (payload +
  sourceUrl + confidence), stamped nothing yet.
- A curator opens the `/admin` import-review UI (built in R1-3), sees the payload and confidence,
  **edits then approves** (or rejects). On approve the server runs Bean Validation + the
  category-template attributes check and creates the real Competition with
  `provenance.source = import` and this pipeline's confidence.
- **Organizer resolve-or-create (2026-07-16).** The payload carries `organizerName`, not an org id.
  The review UI shows an **Organizer panel**: an exact-name match "will be reused", similar names
  offer pick-one buttons (or a "create as new anyway" checkbox), and a missing organizer is a
  warning + org search. On approve the server reuses an org on an exact (normalized) name match,
  else **creates a CURATED/HOST org** — so seeding never pre-creates orgs by hand. A near-match
  without confirmation, or an archived same-named org, is a 422 the curator resolves. See
  `docs/domain-model.md` §3b.
- **Curators write our own `description`.** This tool deliberately leaves it `null` — facts aren't
  copyrightable, prose is. Extracted facts are a scaffold, not publishable copy.

## v0 limitations (follow-ups)

- **robots.txt** handling is best-effort (matching `Disallow`/`Allow` longest-prefix, exact
  UA-token groups), not a full RFC 9309 parser (no `*`/`$` wildcards); there's **no crawl-delay /
  rate limiting** yet. Be gentle with batches.
- **Transient fetch faults are retried** (up to 3 attempts, exponential backoff) for thrown network
  errors and 5xx — the top-25 seeding sweep showed real hosts intermittently dropping a TLS
  connection (artandwriting.org failed one row, succeeded the next). **Persistent blocks are NOT
  retried and need manual curation:** a `robots.txt` disallow (e.g. uscyberpatriot.org) or a 403
  bot-block behind a WAF (e.g. vexrobotics.com). A JS/browser-emulating fetch for those is out of
  v0 scope — a curator enters them by hand.
- **The private-address guard checks literal IPs + localhost names only** — a public DNS name that
  resolves to a private address (DNS rebinding) is not caught. Acceptable for an operator-run CLI;
  a server-side fetcher would need resolution-time checks.
- **HTML→text** is a regex distiller, not a DOM/readability extractor; JS-rendered pages won't
  yield text (v0 fetches static HTML only).
- **Single-page** extraction — no multi-page crawl/merge (rules + FAQ + dates pages) yet.
- **Batch rows sharing a URL are deduped** (first occurrence wins, count logged; dedup runs before
  `--limit`, so "top N" means N distinct pages). Umbrella programs listed on several master-index
  rows — AMC 8/10/12 → one `maa.org` page; Scholastic Art + Writing → one `artandwriting.org`
  page — extract once; **splitting one page into distinct listings is a curator decision at S4**,
  and un-deduped re-extraction would otherwise burn LLM calls and 409 on the shared slug. **No
  dedupe against already-published competitions** — a collision with an existing slug still surfaces
  as a 409 on approve.
- **Optional attribute keys emitted as an explicit `null`** (the LLM sometimes writes
  `"eligible_countries": null`) are **pruned in normalization** — an absent key is the correct
  "unknown" encoding, so a null no longer fails the template's `type` and sinks the record to INVALID.
- **Master-index hints guide extraction and flag disagreements.** A batch row's known facts
  (name/organizer/category/cost/participation/pathway/grade band) are passed to the model as trusted
  guidance for when the page is silent; the **page still wins on conflict**, and a surviving
  disagreement on cost/participation/pathway/category is surfaced as a curator warning
  (`src/hints.ts`). Grade band is a prompt hint only — not flagged (parsing "K-8"/"Pre-K-2" into a
  range is too ambiguous to trust). Hints are absent on single-`--input` runs and plain `.txt` batches.
- **Category templates are mirrored** from seed `0005` in `src/categories.ts`; if a template is
  edited via the admin tool, refresh that file. The server re-validates on approve regardless.
- **No CI job** for this tool in this PR (kept out of CI to avoid destabilizing the web/api
  pipelines). A **follow-up** could add a separate workflow, path-filtered on `tools/seeding/**`,
  running `npm ci && npm run typecheck && npm test` — the offline stub makes it network/key-free.
