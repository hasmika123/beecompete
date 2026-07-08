# BeeCompete — Legacy Prototype Reference

**Status:** Reference (frozen) · **Created:** 2026-07-08 · Source of: registry Rev 7, domain-model additions (2026-07-08)

A Lovable/Supabase prototype of BeeCompete ("legacy-transfer-hub") was reviewed on 2026-07-08.
This doc preserves the **reusable design detail** found there so later phases can mine it
deliberately, plus what was adopted/rejected. The repo itself lives outside this repo
(reviewed at `~/Downloads/legacy-transfer-hub-main/`; archive it somewhere durable — if the
path moves, update this line). Key artifacts: `DATABASE_SCHEMA.sql`, `db/patches/*.sql`
(~70 files), `TESTING_USECASES.md`, feature guides (`REGISTRATION_FORM_BUILDER_GUIDE.md`,
`PRACTICE_QUESTIONS_FLOW.md`, `USER_MANAGEMENT_GUIDE.md`).

---

## 1. Adopted into planning (2026-07-08 — owner-approved)

See registry **Rev 7** and domain-model 2026-07-08 notes for the normative versions:

1. **`entry_pathway`** Spine column (individual / school-or-chapter / either) + filter facet +
   at-a-glance line — from the legacy chapter participation/registration modes.
2. **`age_cutoff_date`** on Edition — age eligibility "as of a date".
3. Citizenship/residency country lists + `student_status_required` → standard **attributes-bag keys**.
4. **Awards**: typed `prize_summary`/`prize_value`/`prize_currency` on Edition now + reserved
   **`Award`** entity (supports non-monetary types + travel grants) + registry **H47**.
5. **Waitlist** folded into H4; **private/invite-only listings** as **H48**; **past winners on
   curated listings** as **M33**.
6. **Member ID** (public handle) reserved on `User` — teammate invites without exposing minors' emails.
7. **Host-affiliated chapter networks** noted on H7/X8 + glossary Chapter.
8. **Syllabus/topics** as attributes-bag keys feeding Participant+ practice content (P8 note).
9. Anti-decision: **no 1:1 private messaging with minors** (compliance §1; M17 note).
10. *(Later on 2026-07-08, registry Rev 8):* the legacy **paid-public / free-private** split was
    adopted after all, in refined form — public listing of *self-created* competitions is
    entitlement-gated (`public_listing`, in every paid tier); free tier = capped private hosting;
    claiming *curated* listings stays free. See `monetization.md` §2/§4/§8.

## 2. Reference design detail for reserved entities *(mine when the phase opens)*

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

## 3. 🛑 Gate A/B inputs — deliberately NOT mined

The legacy has a working judging/results system. Per the design gates
(`development-process.md` §6a) its design was **not** reviewed or extracted — only cataloged:
- `db/patches/2026-02-20_judging_results_system.sql` (incl. `competition_awards` assignment to
  submissions, per-stage criteria/rubric-PDF/tie-break fields)
- `src/components/judging/` (host judging tab, participant results)

Feed these to the Gate A/B deep-dives alongside the fair-director interviews.

## 4. Deliberately rejected legacy patterns

- ~~**Tier-gated public visibility**~~ — **adopted in refined form after all** (owner, 2026-07-08,
  registry Rev 8): public self-publishing is entitlement-gated like the legacy model, but claiming
  a *curated* listing stays free and the curated catalog remains the public audience engine —
  which the legacy model lacked. See §1 item 10 and `monetization.md` §8.
- **Host-level Stripe subscriptions** (BASIC/PREMIUM/ENTERPRISE) — superseded by per-Edition
  tiers + optional annual (`monetization.md` §4).
- **1:1 private messaging** between hosts/adults and minor participants — recorded as an
  anti-decision (compliance §1); public moderated Q&A (M17) + announcements (H9) instead.
- **Free unlimited practice** — superseded by Participant+ packaging.
- **Hard deletes, no provenance** — superseded by D7 soft-delete + provenance/trust model.
