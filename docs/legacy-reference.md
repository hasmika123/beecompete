# BeeCompete — Legacy Prototype Reference

**Status:** Reference (frozen) · **Created:** 2026-07-08 · **Type:** Reference

A Lovable/Supabase prototype of BeeCompete ("legacy-transfer-hub") was reviewed on 2026-07-08.
This doc keeps **only the design detail worth mining later** — the distilled extraction of a
working prototype that would otherwise be lost. **What the review *decided* is not here** — those
choices live normatively in the decision logs of `feature-registry.md` (Rev 7/8), `domain-model.md`,
`monetization.md` §8, and `compliance.md`. This doc is the *raw material*, not the ruling.

> **Source:** the legacy repo lives outside this repo (reviewed at
> `~/Downloads/legacy-transfer-hub-main/`). **Archive it somewhere durable** — once it's gone, the
> sections below are the only record. Key artifacts: `DATABASE_SCHEMA.sql`, `db/patches/*.sql`
> (~70 files), `TESTING_USECASES.md`, and the feature guides.

---

## 1. Design detail for reserved entities *(mine when the phase opens)*

**Registration status machine** (for reserved `Registration`; legacy `2026-01-30_status_system_refactor.sql`):
`INVITED → PENDING_ACCEPTANCE → (DECLINED) → PENDING_PAYMENT → PENDING_APPROVAL → (REJECTED) →
ACTIVE → WITHDRAWN | DISQUALIFIED | COMPLETED`. Competition lifecycle:
`DRAFT → PENDING_APPROVAL → ACTIVE → PAUSED → COMPLETED → ARCHIVED`.

**Team formation mechanics** (for reserved `Team`; patches `2026-02-05/06_*team*`):
lifecycle `FORMING → ACTIVE | INCOMPLETE | CANCELLED | EXPIRED | COMPLETED`; team activates when
min size reached (activation threshold); pending invites **expire at the registration deadline**;
captain/member roles; invites carry the registration `form_responses`; invite by member ID.

**Stage model** (for `Round`/`KeyDate`/HC7 design; patch `2025-11-05_create_competition_stages.sql`):
stage types (SUBMISSIONS / LIVE_EVENT / JUDGING / ANNOUNCEMENTS / MILESTONE / OTHER); system "base
stages" seeded on creation (created / registration / event / submission / results); publish states
(DRAFT / SCHEDULED / PUBLISHED / ARCHIVED); **segmentation** (ALL_PARTICIPANTS / ADVANCING_ONLY /
CUSTOM_LIST); `depends_on_stage_id` + auto-unlock; per-stage submission windows/artifacts,
instructions, resources, notification toggles (on publish / 24h before end / on update), and
internal host notes; `visible_to_participants_at` scheduling.

**Registration form builder** (for H5/H37): 24+ field types — basic (text/long-text/email/phone/
URL/number/date/dropdown/multi-select/radio/checkbox/file), advanced (country, state), team fields
(member ID, team name, team size), professional (LinkedIn/GitHub/portfolio/institution/grad-year/
experience). Drag-drop canvas + property panel + desktop/mobile preview; responses stored as JSONB
on the registration.

**Practice engine** (for Phase-2 Participant+): per-question `alternative_answers[]`,
`topic`/`subtopics[]` keyed to a competition syllabus, difficulty, explanation, estimated-time
metadata; client answer verification with spelling tolerance (~85% similarity) and partial-match
states; saved-questions list; per-competition progress persistence. *(Legacy gave practice away
free; we monetize per `monetization.md` §3 — teaser stays free.)*

**Child-account flows** (implementation reference for X2/X3/RFC): bidirectional link requests
(parent→child and child→parent, both approval-gated); child→regular **account transition requests**
with parent approval + email verification (our RFC's "child turns 13" line).

**Chapter mechanics** (for H7/X8/E8): host-owned chapters with auto-generated **join codes**;
"apply to found a chapter" applications (desired role, location, message → review → created
chapter); roles lead / co-lead / mentor / student; per-competition participation
(DISABLED/OPTIONAL/REQUIRED) and registration modes (SELF / LEAD_AND_SELF / LEAD_ONLY) with
host-level defaults + per-competition override.

## 2. 🛑 Gate A/B inputs — deliberately NOT mined

The legacy has a working judging/results system. Per the design gates
(`development-process.md` §6a) its design was **not** reviewed or extracted — only cataloged, to
feed the Gate A/B deep-dives alongside the fair-director interviews:
- `db/patches/2026-02-20_judging_results_system.sql` (incl. `competition_awards` assignment to
  submissions, per-stage criteria/rubric-PDF/tie-break fields)
- `src/components/judging/` (host judging tab, participant results)
