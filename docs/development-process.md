# BeeCompete — Development Process & Release Strategy

**Status:** Living document · **Last updated:** 2026-07-18 · Depends on: `feature-registry.md`, `architecture.md`

How work flows from a feature-registry line to shipped code, and **when we go public**. Tuned for a
solo + AI-assisted builder: lightweight, repeatable, with the review discipline that a missing
second reviewer would otherwise provide baked into checklists and CI.

---

## 1. Repository & branching

- **Monorepo** (`/apps/web`, `/apps/api`, `/packages/ui`, `/infra`, `/docs`).
- **Trunk-based**: `main` is always deployable and **protected** (no direct pushes; CI must pass).
- **Short-lived branches** off `main`, named by type + registry ID:
  `feat/M8-tracker`, `fix/X3-consent-bug`, `chore/ci-scan`. Merge within days, not weeks.
- **Squash-merge** to keep `main` history clean; one PR = one logical change.
- **Merged ≠ released.** `main` continuously integrates (unfinished work hidden behind **feature flags**); shipping to **production is a separate, deliberate act** — a **tagged release** (R1, R2…) when a phase/release is ready. **No long-lived phase branches** (they cause merge hell). *Optional:* a short-lived `release/rX` branch only for final stabilization right before a launch.

## 2. Tracking: Issues, board, milestones

- **GitHub Issues** — one issue per feature, **titled with its registry ID** (e.g., "M8 — My Competitions tracker"). Description = acceptance criteria.
- **GitHub Projects board** (Kanban): `Backlog → Ready → In progress → In review → Done`.
- **Milestones = phases** (Phase 1–4) and **releases** (R0–R5 below). Every issue has a phase milestone.
- **Labels:** `facet:marketplace|participant|host`, `type:feat|fix|chore|docs`, `phase:1–4`, `priority`, `compliance`, `a11y`.

## 3. The per-feature loop (repeat for every registry item)

**Two tiers — match the ceremony to the risk:**
- **Full loop** (all steps below): any task that is 🔒 compliance-tagged, touches the schema or a
  migration, is L/XL complexity, or opens a new subsystem.
- **Light loop** (S/M tasks inside existing patterns): steps **1 → 2-lite → 6 → 7 → 10** only. The
  **investigation step is never skipped** — but it's the 2-minute version (§3a "lite"): find the
  existing patterns/components to reuse *before* writing anything. The written summaries, the
  plan-approval gate, and the handoff ceremony are dropped; the issue still gets a one-line status
  update on completion.

- **Hero surfaces** (the pages listed in `docs/design-brief.md` §5) always run the **full loop**,
  regardless of size, and their Plan step (4–5) includes a **visual design pass**: your
  references/preferences are captured in the design brief → Claude builds a **throwaway HTML
  prototype** for you to react to → 🧑 **you approve the look** → then the real page is implemented
  with `packages/ui` primitives. The merged page must match the approved prototype.

Human-decision gates are marked 🧑 — Claude **pauses for you** there (full loop + hero design passes).

1. **Pick** an issue from `Ready` (respect phase order + foundation-hook dependencies).
2. **Investigate** — Claude runs the investigation protocol (§3a) and posts an **Investigation summary** to the issue.
3. 🧑 **Clarify** *(conditional — only when there are doubts, ambiguity, or open scope questions)* — Claude **asks before planning** rather than guessing; **skipped entirely when the requirement is clear.**
4. **Plan** — Claude writes an implementation plan.
5. 🧑 **Approve** — Claude explains the plan **in plain language**; you approve (or adjust) *before any code is written*.
6. **Branch** (`feat/<ID>-<slug>`) and **implement** in a vertical slice (DB → API → UI), **behind a feature flag**, committing as you go (Conventional Commits, tests alongside).
7. **Tests run** — unit + integration + e2e for critical flows; CI on the PR (§5).
8. **Fresh review** — a clean-context review of the diff (catches what author-bias misses).
9. **Progress update** — Claude records status + an **implementation summary** on the issue (§3b).
10. **Squash-merge** to `main` (flag off) → **delete the branch** → auto-deploy to staging → verify.
11. Flip the flag **on** at the next **release** (§7).

*(The 🧑 inspect gate was removed 2026-07-07 — fresh review + CI + the Definition-of-Done checklist
stand in for it. You review via the PR / issue summaries whenever you choose, not as a blocking step.)*

### 3a. Investigation protocol (lightweight, before planning)
Claude checks — and summarizes on the issue:
- The registry item + acceptance criteria + relevant `docs` sections (domain-model, architecture, glossary terms).
- Which modules/files it touches; existing patterns to match.
- **Schema / foundation-hook impact** (reserved entities? migration needed?).
- Dependencies (other features, external services) + **security/compliance** implications (PII? minors? authz? consent?).
- Test strategy.

**Lite version (light-loop tasks):** no write-up — just the pattern/component scan: check
`packages/ui` and the neighboring modules for an existing implementation **before writing anything
new**. This is the step that prevents duplicated components; it is never skipped at any tier.

### 3b. Progress tracking (so switching chats is safe)
The **GitHub Issue is the durable source of truth** — any new chat/session reads it to know exactly where things stand:
- **Investigation summary** + **approved plan** posted as comments.
- A running **Progress** checklist, updated as sub-steps complete.
- On any pause/handoff: a **Handoff note** — *current state · what's done · next step · open questions · branch name* — so a fresh session resumes cleanly.
- On completion: an **Implementation summary** — *what was built · key files · decisions · how to verify · follow-ups*.
- The board column (`In progress`/`In review`/`Done`) gives at-a-glance status.

## 4. Definition of Done (the self-review checklist that replaces a second reviewer)

A feature isn't done until:
- [ ] Meets acceptance criteria; happy path + edge cases handled.
- [ ] **Tests**: unit (logic) + integration (API+DB) for new behavior; e2e for critical flows.
- [ ] **Security**: input validated server-side (Bean Validation); authz enforced on the API; no secrets in code.
- [ ] **Compliance** (if it touches user data): consent/privacy respected; no student-data selling/targeting; affiliate disclosure if affiliate links.
- [ ] **Accessibility**: keyboard-navigable, labels, contrast — WCAG 2.1 AA on new UI.
- [ ] **Shared UI**: uses `packages/ui` primitives; no inline SVGs / hand-rolled styles.
- [ ] **Reuse check**: searched `packages/ui` and neighboring modules for an existing implementation before creating anything new (component, util, query, style).
- [ ] **Docs**: registry/ADR/relevant doc updated if scope or a decision changed.
- [ ] **Issue updated** with the implementation summary (§3b) — the work is resumable from any chat.

## 5. CI/CD gates (GitHub Actions)

- **`ci.yml`** on every PR/push: web + API test suites, lint/format, **dependency + secret scan + SAST**, build check. All green required to merge.
- **`deploy.yml`** on merge to `main`: build images → push to GHCR → SSH to VPS → pull + restart, Liquibase migration step, health check, rollback path.
- Environments: **staging** auto-deploys from `main`; **production** promotes on a tagged release.

### Keeping Actions cheap (minute budget)
- **Cost:** a **public repo = unlimited free** Actions minutes; a **private repo = 2,000 free min/month** (Free plan), then ~$0.008/min (Linux). A solo builder rarely exceeds the free tier early.
- **Make runs fast & cheap:** aggressive **caching** (Gradle, pnpm/node, Docker layers); **path filters** (run API jobs only when `/apps/api` changed, web only when `/apps/web` changed — a big monorepo saver); **cancel-in-progress** concurrency (kill superseded runs); and **build Docker images only on merge-to-`main`** (deploy) — PRs run the *fast test suite only*, not image builds.
- **Escape hatch:** a **self-hosted runner on the VPS** (free compute) if minutes ever get tight.
- **Bottom line:** it won't run "too many hours" — the slow part (Docker builds) happens only at deploy, and tests are cached + path-filtered.

## 6. The per-phase loop

Each phase (1–4) runs the same arc:
1. **Kickoff deep-dive** — write the just-in-time design/RFC for that phase's hard subsystems (e.g., Phase 1 = auth/consent; Phase 2 = payments/entitlements). *This is where the depth we deferred gets done.*
2. **Write the phase build plan** (ordered tasks, e.g., `phase-1-plan.md`) **and turn every task into a GitHub Issue** on the board — **required for every phase, before coding.** No phase starts implementation until its tasks exist as issues, so nothing is forgotten or tracked only in chat.
3. **Build vertical slices** — one competition type / one flow end-to-end first, then broaden.
4. **Phase exit criteria** met (below) → **release**.

### 6a. 🛑 Phase-3 design gates *(hard pause points — do not design or build past these)*

Judging and the science-fair system are **deliberately not designed ahead of time** — no schema, no
RFC, no implementation before their deep-dives, so the design is driven by validated real-world
needs instead of competitor feature lists. Two mandatory gates:

- **Gate A — Science-fair wedge deep-dive** *(opens Phase 3; blocks ALL Phase-3 wedge work: HC1–HC8,
  H4–H7 as used by fairs, advancement H25).* Inputs required before design starts: fair-director
  interview notes (outreach runs through Phases 1–2 — see `go-to-market.md` §3), the zFairs /
  STEM Wizard feature bar, ISEF form requirements, and the **legacy-prototype reference**
  (`legacy-reference.md` §1 — registration/team/stage state machines, chapter mechanics). Output:
  the wedge RFCs (registration, compliance/consent chain, advancement) + `phase-3-plan.md`. Only
  then build.
- **Gate B — Judging deep-dive** *(blocks all judging tasks: H12–H17, H25 rule enforcement).* Design
  the Rubric / Score / JudgingAssignment model from what the Gate-A fairs actually need. Inputs
  include the deliberately-unmined legacy judging artifacts (`legacy-reference.md` §2). Typically
  runs inside Phase 3 once wedge work makes judging the next slice.

**Claude: when work reaches either gate, STOP and tell the user the gate has been reached** — do not
proceed to research, design, or implementation of gated items until the user kicks off that deep-dive.

---

## 7. Release strategy — YES, we go public well before the app is "finished"

**The key answer to "can we launch before finishing everything": absolutely — and we should.** The
marketplace is a **standalone, valuable product** on its own, and launching it early is how we build
the audience that makes Participant+ and Host Tools sellable (the whole flywheel). We ship a **ladder
of public releases**, each a real launch:

| Release | What's live | Compliance load | Why here |
|---|---|---|---|
| **R0 — Waitlist** | Landing page + email capture (Brevo) | Minimal (privacy policy; treat emails carefully) | Start list-building **immediately**, before code. |
| **R1 — Browse-only marketplace** | Seeded listings, search/filter, detail pages, SEO — **no accounts** | **Light** — no accounts = **no COPPA consent flows** (still need privacy policy + affiliate disclosure) | Earliest real public product. Builds **SEO + traffic** fast with low compliance burden. |
| **R2 — Marketplace + accounts** (full Phase 1) | Save/track, reminders, personalized recs, accounts | **Full** — COPPA consent, all legal pages, a11y | The core public **beta** launch. |
| **R3 — Participant+** (Phase 2) | Prep packages, parent/educator, payments | + PCI (via Stripe), sales tax | First revenue. |
| **R4 — Host Tools: science-fair wedge** (Phase 3) | Host verification, registration, submissions, K-12 compliance/consent/advancement, basic judging, promotion | + host KYC, e-sign consent chain | Supply side + promotion revenue; captures fairs displaced by Scienteer's collapse. |
| **R5 — Judging depth & institutional** (Phase 4) | Advanced judging suite, UGC creator marketplace, institutional | + FERPA/DPAs | Full platform. |

**The important insight:** **R1 (browse-only) is the recommended first public launch** — it deliberately
*defers* accounts so it defers the heaviest compliance (COPPA consent) while still shipping a real,
SEO-driving product. Accounts/tracker (R2) follow once the consent flow is built and reviewed.

Everything ships under a **Beta tag + disclaimer** until we deem it stable.

## 8. Release / phase exit criteria (the gate every public release must pass)

- [ ] All milestone issues `Done`; no known critical bugs.
- [ ] **Content-readiness gate** met for the release (e.g., the R1 catalog targets in `phase-1-plan.md` §"Data seeding & catalog readiness") — a release with an empty catalog doesn't ship.
- [ ] **Compliance gate** (see `compliance.md`) for that release's data scope — legal pages live; consent working if PII collected; attorney sign-off before R2.
- [ ] Security: WAF + rate limiting on; secrets in env; **backups restore-tested**.
- [ ] Accessibility: WCAG 2.1 AA on public surfaces.
- [ ] Observability: Sentry + uptime + analytics live; alerting works.
- [ ] Rollback tested.

## 9. Conventions
- **Conventional Commits** (`feat:`, `fix:`, `chore:` …) → clean history + changelog.
- **ADRs** in `docs/adr/` for significant decisions; docs updated with the code that changes them.
- **Feature flags** (PostHog) to merge incomplete work safely dark and roll out gradually.
- **Repo `CLAUDE.md`** at the root encodes the conventions every AI session must follow (shared UI from `packages/ui` — search before creating; never inline SVGs; module layout; DTO/validation patterns). Update it whenever a convention changes — it's the highest-leverage guardrail for light-loop tasks (created in F1).
- **Periodic cleanup pass:** `/simplify` / `/code-review` do **not** run themselves — they're commands invoked in a Claude Code session. So it isn't forgotten: **Claude proactively runs (or offers) a cleanup pass after ~5–10 light-loop merges and before every release tag.** You can also trigger one anytime by typing `/simplify`.
