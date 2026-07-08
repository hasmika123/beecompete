# BeeCompete — Feature Registry

**Status:** Living document · **Owner:** Product · **Last updated:** 2026-07-08

The master list of every feature across all three facets and all phases. This is the
**single source of truth for scope** and the **anti-creep tool**: if a feature isn't here,
it isn't planned; if it's here, its phase and foundation impact are explicit.

Its most important output is the **[Phase-1 Foundation Hooks](#phase-1-foundation-hooks)**
section at the bottom — the things the initial data model *must reserve room for* even
though we build them later. Those feed directly into the Domain & Data Model doc.

> **Rev 2 (2026-07-06):** integrated 46 candidate features. New **DQ** (Data Quality, Trust
> & Compliance) and **PA** (Parent/Guardian) sections added; competition **structure**
> (divisions, rounds, advancement) and the **participant↔competition lifecycle** promoted to
> foundation hooks. See validation notes in chat history for merges/deferrals.
>
> **Rev 3 (2026-07-06):** competitor research integrated (see `competitive-analysis.md`). Added
> H29–H45 (judging/host depth matching Award Force, Evalato, Reviewer, Submittable, RocketJudge,
> zFairs, Devpost) and new **HC** section (K-12 compliance/consent/advancement from STEM Wizard/
> Scienteer/zFairs). M28 promoted-listings expanded to a product line; monetization in `monetization.md`.
>
> **Rev 4 (2026-07-06):** decisions locked — 0% entry-fee cut; Participant / Participant+ / Participant²
> naming; compliance+judging held to Phase 4. Added host-verification cluster **DQ11–DQ14** (anti-scam
> gating for self-published listings).
>
> **Rev 5 (2026-07-07):** **Scienteer wedge prioritized** — Phase 3 re-anchored to the science-fair
> wedge (supersedes Rev 4's "compliance+judging held to Phase 4"): HC1/HC2/HC5/HC6/HC8 and basic
> judging (H12–H17, H25) moved 4→3; UGC creator items (P11–P14) moved 3→4. See `monetization.md` §8.
>
> **Rev 6 (2026-07-07):** engagement/growth gap-fill — added **M29** (follow-by-email, no account),
> **M30** (edition-cycle re-engagement), **M31** (social-proof counts), **DQ15** (suggest a
> competition), **H46** (host claim-interest CTA), **B11** (embed badge); **M10** upgraded to a
> subscribable iCal feed; **X20** gains zero-result search tracking. Domain model: `ParticipantProfile`
> now stores **`grad_year`** (grade derived) so profiles don't rot at school-year rollover.
>
> **Rev 7 (2026-07-08):** legacy-prototype review integrated (see `legacy-reference.md`). Spine gains
> **entry pathway** (M3 facet; domain-model column) + `age_cutoff_date` + typed prize summary; added
> **H47** (award structures), **H48** (listing visibility control), **M33** (past winners on curated
> listings); **H4** gains waitlist; member-ID invites noted on H7/M18; host-affiliated chapter
> networks noted on X8/H7; topics/syllabus noted on P8; anti-decision recorded: **no 1:1 DMs with
> minors** (compliance §1, M17).

---

## How to read this

**Phase** — when we intend to *build* it:

| Phase | Theme |
|---|---|
| **1** | Marketplace MVP (discovery, seeded listings, tracker, accounts + parental consent, curated/affiliate resources) |
| **2** | Participant+ v1 + Educator dashboard (real revenue #1 + growth engine) |
| **3** | Host Tools v1 — **science-fair wedge first** (registration, K-12 compliance/consent/advancement, basic judging) |
| **4** | Advanced judging suite, UGC creator marketplace, institutional subscriptions, expansion beyond K-12 / US |
| **Backlog** | Captured idea, no committed phase (parked to protect the foundation from creep) |

**Cx (complexity):** S = small · M = medium · L = large · XL = very large.
**Markers:** 🪝 = design-in hook (schema must reserve room in P1) · 💲 = revenue lever · ⚠ = advanced / accuracy or scope risk, validate before committing.

**Disposition** — the triage discipline. Every item is **Build** (in its phase), **Design-in** (🪝), or **Park** (Backlog).

---

## X · Cross-cutting / Platform (foundation)

| ID | Feature | Phase | Cx | Foundation hook / notes |
|---|---|---|---|---|
| X1 | Multi-type accounts (student/parent/educator/host/admin) | 1 | M | 🪝 One user model with type/role discrimination from day one |
| X2 | Parent–guardian ↔ minor account linking | 1 | M | Required for COPPA consent + parent-as-payer |
| X3 | Age gating + parental consent (COPPA) flow | 1 | L | Legal requirement — users are minors |
| X4 | Authentication (email/password + social) | 1 | M | School SSO deferred to P4 |
| X5 | RBAC — roles & permissions | 1 | L | 🪝 Org-scoped; v1 ships minimal roles but model is complete. Covers host staff, judges, coach/mentor roles |
| X6 | Organization entity (host orgs, schools, chapters) | 1 | M | 🪝 First-class `Organization` even if barely used in v1 |
| X7 | Membership model (User ↔ Org w/ role) | 1 | M | 🪝 Multi-user orgs & chapters become additive later |
| X8 | Roster / Group model (coordinator ↔ students) | 2 | M | 🪝 Reserve in P1; powers educator cohorts + team registration. Chapters may be **host-affiliated networks** (CTSO-style, join codes + applications), not only educator-created groups (Rev 7; `legacy-reference.md`) |
| X9 | Taxonomy + category templates (spine + per-category schema) | 1 | XL | **CORE.** Standardized-yet-flexible schema. Now also carries divisions/rounds/advancement (see hooks) |
| X10 | Search & faceted filtering infrastructure | 1 | L | |
| X11 | Notifications (email + in-app) + preferences | 1 | M | |
| X12 | Deadline reminder engine | 1 | M | Scheduled off Edition date-events |
| X13 | Activity / event log (append-only) | 1 | M | 🪝 Single source for ALL progress derivation + audit |
| X14 | Approval / workflow substrate (status + transitions + audit) | 3 | M | 🪝 Approvable entities get `status` + audit fields in P1 |
| X15 | Payments (Stripe) — checkout, entitlements, refunds | 2 | L | 🪝 Payer ≠ beneficiary (parent/educator pays, student holds) |
| X16 | Admin / curation tooling (internal) | 1 | L | Data quality is the moat. v0 = R1-3/R1-3b (CRUD + import & corrections queues, behind Cloudflare Access); support tooling = R2-17b; staged build-out in architecture §13 |
| X17 | Data ingestion pipeline | 1→ | L | 🪝 Provenance/source fields; manual seed → import → host-submitted → crowdsource. v0 = the AI-assisted extraction pipeline (fetch official pages → LLM → schema-validated JSON → human curation queue) — see `phase-1-plan.md` §"Data seeding" |
| X18 | Recommendation / matching engine | 1 (basic) → 2+ | L | Grade + interest + region |
| X19 | Media / file storage | 1 | M | Logos/resources now; submissions & prep later |
| X20 | Analytics / telemetry | 1 | M | Surfaces demand → drives depth-on-demand seeding; includes **zero-result search tracking** (what users searched and didn't find → seeding priorities) |
| X21 | Data privacy / export / deletion (compliance) | 1 | M | Minors → stricter handling |
| X22 | Feature flags / config | 1 | S | |
| X23 | **Participant ↔ Competition lifecycle** (status state machine) | 1 | M | 🪝 saved → registered → preparing → submitted → completed → result; works for hosted *and* external comps. Powers tracker, history, progress |

## DQ · Data Quality, Trust & Compliance *(the moat + the legal floor)*

| ID | Feature | Phase | Cx | Notes |
|---|---|---|---|---|
| DQ1 | Data provenance + confidence indicators (user-facing) | 1 | M | 🪝 Every listing shows source, freshness, verification, confidence |
| DQ2 | Stale listing detection | 2 | M | Flags listings past dates with no new Edition |
| DQ3 | Annual listing re-verification | 2 | M | Ties to Edition recurrence; prompts refresh each cycle |
| DQ4 | Duplicate competition detection & merging | 2 | L | Critical once importing/crowdsourcing |
| DQ5 | Conflicting-source resolution | 3 | M | Reconcile disagreeing sources; extends provenance |
| DQ6 | User-submitted competition corrections | 1 | M | Light crowdsource; stored as `CorrectionProposal` rows, curator-approved (see `domain-model.md` D7) |
| DQ7 | Trust & safety reporting | 2 | M | Report bad content/behavior. Elevated priority — minors |
| DQ8 | Moderation queue | 2 | M | For corrections, reviews, UGC, reports |
| DQ9 | Admin override / support tooling | 1 | M | Extends X16; tasked as **R2-17b** (needs auth/RBAC + user accounts to exist, so it builds in R2) |
| DQ10 | Affiliate disclosure system | 1 | S | FTC requirement — ships with affiliate links (M11) |
| DQ11 | **Host identity verification** (edu/org email domain, domain-ownership proof, nonprofit/business lookup, Stripe KYC) | 3 | M | 🪝 Gate to claim/publish a listing |
| DQ12 | **Pre-publication moderation gate** — self-submitted listings reviewed (or auto-approved for verified-domain hosts) before going public | 3 | M | "Public posting" = submit for review, never instant anonymous publish |
| DQ13 | **Verified-organizer badges + host trust tiers** (curated / claimed / verified / unverified) | 1 | M | User-facing; extends DQ1 provenance. Public **maintainer attribution** (locked 2026-07-07): "Listing **maintained by** BeeCompete Curation Team" while curated (team-level, never individual staff names) → flips to the host org after claim. Wording rule: **"maintained by," never "managed by"** — no implied operation of/affiliation with the competition (compliance §8) |
| DQ14 | Scam/abuse heuristics (off-platform-payment flags, minor-safety review, progressive host reputation) | 3 | M | Extra scrutiny because users are minors |
| DQ15 | **"Suggest a competition"** — user-submitted new-listing requests → curation queue | 1 | S | Complements DQ6 (which covers corrections to *existing* listings only); demand signal feeds seeding priorities (S2) |

## M · Facet 1 — Marketplace / Discovery *(acquisition engine, not primary revenue)*

| ID | Feature | Phase | Cx | Notes |
|---|---|---|---|---|
| M1 | Browse competitions | 1 | S | |
| M2 | Keyword search | 1 | M | |
| M3 | Faceted filters (category, grade, region, cost, format, individual/team, **entry pathway**, deadline) | 1 | M | Entry pathway = individual vs. school/chapter-only entry (Rev 7) — a top parent eligibility question |
| M4 | Sort (deadline, popularity, newest) | 1 | S | |
| M5 | Standardized competition detail page | 1 | M | Renders the spine |
| M6 | Edition display (dates / registration / status) | 1 | M | Two-level model surfaces here |
| M7 | Save / follow competition | 1 | S | |
| M8 | "My Competitions" tracker (deadline dashboard) | 1 | M | **Stickiest retention mechanic**; driven by X23 lifecycle |
| M9 | Deadline reminders | 1 | S | Uses X12 |
| M10 | Calendar view + **subscribable iCal feed** (live-updating) + one-time export | 1 | M | Feed > export — deadlines stay current in the student's own calendar |
| M11 | Curated resources + affiliate links | 1 | M | 💲 Content model #1; disclosure via DQ10 |
| M12 | Personalized recommendations | 1 (basic) / 2 (adv) | M | Uses X18 |
| M13 | Onboarding interest quiz (grade/interests/region) | 1 | S | Feeds matching |
| M14 | New-competition alerts matching interests | 1 | S | |
| M15 | SEO landing pages (per competition & category) | 1 | M | Primary organic growth channel |
| M16 | Reviews & ratings | 2 | M | Moderated via DQ8 |
| M17 | Past-participant Q&A / discussion | 3 | M | Public + moderated only — **no 1:1 private messaging with minors** (anti-decision, Rev 7; compliance §1) |
| M18 | Team-finder / teammate matching | 3 | L | Network-effect lever. 🔒 **Consent-upgrade:** makes a child's profile visible to others (third-party disclosure) → stronger parental consent required (see `rfc-p1-auth-consent.md` §5). Invites go by **member ID**, never by exposing a minor's email (Rev 7) |
| M19 | Editorial guides / blog | 2 | M | SEO + content marketing |
| M20 | Verified competition record / student profile | 4 | L | Admissions currency (verified; cf. M24 self-reported) |
| M21 | Share competition | 1 | S | |
| M22 | Compare competitions side-by-side | Backlog | S | Park |
| M23 | External registration status tracking | 1 | S | Mark registered/submitted for off-platform comps; uses X23 |
| M24 | Personal competition history (self-reported) | 2 | M | Lighter precursor to verified record (M20) |
| M25 | Related / similar competitions | 1 | S | On detail page; uses X18 |
| M26 | Personalized digests / newsletter | 2 | M | Retention; extends M14 |
| M27 | Referral program | 2 | M | Growth lever |
| M28 | Promoted / featured listings (product line: featured search · spotlight · digest · rec-boost) | 3 | M | 💲 **Facet-1 primary revenue.** Relevance-gated, capped, labeled. See `monetization.md` §5 |
| M29 | Follow a competition **by email, no account** ("notify me about this competition") | 1 | S | R1 bridge: converts SEO traffic into per-competition audiences before accounts exist; follows convert to accounts at R2 |
| M30 | **Edition-cycle re-engagement** — alert followers/trackers when a followed Competition announces a new Edition/dates | 1 | M | The annual "it's back" resurrection loop — key retention mechanic for annual competitions. Extends M14/X11; keyed off Edition creation |
| M31 | Social proof on listings ("N students tracking", shown above a minimum threshold) | 1 | S | Trust/urgency for users + demand teaser that motivates hosts to claim; uses tracker counts |
| M32 | Organization directory + public org profile pages | 3 | M | Deferred from R1 nav (owner, 2026-07-07); ships with host claiming/profiles. Persistent **nav search** also revisited in Phase 3 (extends M2) |
| M33 | **Past winners / results history on curated listings** | 2 | M | SEO + credibility asset for *external* competitions (H16/H35 only cover platform-hosted results); curation-fed, top competitions first (Rev 7) |

## P · Facet 2 — Participant+ *(real revenue #1)*

*Naming: the free participant experience is **Participant**; the paid per-competition package is **Participant+** (launch); the deferred premium tier is **Participant²**. See `monetization.md` §3.*

| ID | Feature | Phase | Cx | Notes |
|---|---|---|---|---|
| P1 | Prep package catalog (per competition) | 2 | M | |
| P2 | Package detail / preview | 2 | S | |
| P3 | Purchase / checkout (parent-paid) | 2 | M | Uses X15. 🔒 **Consent-upgrade:** card on file enables the stronger parental-verification method — replace R2 email-plus (see `rfc-p1-auth-consent.md` §5) |
| P4 | Entitlement / access management | 2 | M | |
| P5 | Structured study plan | 2 | M | |
| P6 | Practice sets / quizzes | 2 | L | |
| P7 | Package progress tracking | 2 | L | 🪝 Derived from X13 event log |
| P8 | AI-generated practice (+ expert review) | 2 | L | Content model #2. Practice content keys off competition **syllabus/topics** (attributes-bag keys, Rev 7); question shape + answer-verification reference in `legacy-reference.md` |
| P9 | Expert review workflow (internal) | 2 | M | |
| P10 | AI tutoring / hints | 4 | L | |
| P11 | UGC creator onboarding | 4 | L | Content model #3. Moved 3→4 (Rev 5) |
| P12 | Creator content upload / pricing | 4 | L | Moved 3→4 (Rev 5) |
| P13 | Creator payouts / rev-share | 4 | L | Uses X15. Moved 3→4 (Rev 5) |
| P14 | Creator ratings | 4 | S | Moved 3→4 (Rev 5) |
| P15 | Cohort / bulk purchase | 2 | M | Ties to educator (E7) |
| P16 | Live sessions / mentoring | 4 | L | |
| P17 | Certificates of completion | Backlog | S | Park |
| P18 | Gamification (streaks / badges) | Backlog | M | Park |
| P19 | Historical materials / past-papers archive | 2 | L | High-value prep asset + data moat; also a resource type |
| P20 | Mock competitions (full simulated run) | 2 | L | |
| P21 | Timed competition simulations | 2 | M | Real-condition variant of P20 |
| P22 | Study tools — flashcards + spaced repetition | 2 | M | (merges "memorization tools") |
| P23 | Practice drills & games | 2 | M | (merges "timed drills"; games are lower priority) |
| P24 | Strategy & competition-format training (content) | 2 | M | (merges "strategy guidance" + "format training") |
| P25 | Performance analytics — skill/topic, weak-area, trends | 2 | L | (merges 3 items) Uses X13 |
| P26 | Readiness estimation | 4 | L | ⚠ Accuracy risk — validate approach before promising it |
| P27 | Adaptive preparation recommendations | 4 | L | ⚠ Advanced; depends on P25 signal quality |
| P28 | Daily preparation tasks | 2 | M | Retention; ties to study plan (P5) |
| P29 | Assignments (educator/parent-assigned prep) | 2 | M | Ties to E5 |

## H · Facet 3 — Host Tools *(real revenue #2; sold as audience + tooling)*

*Judging (H12–H17) is delivered through a **dedicated judge-facing portal**; judges are an RBAC role (X5).*

*🛑 **Design gate:** no judging item (H12–H17, H25) is designed or implemented until the **Gate B
judging deep-dive** (`development-process.md` §6a) — the model is shaped by what real fairs need
(Gate A research), never ahead of it.*

| ID | Feature | Phase | Cx | Notes |
|---|---|---|---|---|
| H1 | Claim existing (seeded) listing | 3 | M | |
| H2 | Self-serve create / manage listing | 3 | L | Reuses X9 schema |
| H3 | Edition management (yearly instances) | 3 | M | |
| H4 | Registration management (open/close/capacity + **waitlist** with auto-promote on withdrawal) | 3 | M | Waitlist added Rev 7. 🔒 **Consent-upgrade:** registering a child with a host discloses child data to a third party → requires stronger parental consent than R2 email-plus (see `rfc-p1-auth-consent.md` §5) |
| H5 | Custom registration forms | 3 | L | |
| H6 | Roster / registrant list | 3 | M | |
| H7 | Team / hierarchical registration (org→team→students) | 3 | L | Uses X8; convergence with educator. Must support **host-affiliated chapter networks** (join codes, chapter applications, lead-registers-students — the entry vehicle for entry_pathway=school/chapter comps) and **invite-by-member-ID** (Rev 7; design detail in `legacy-reference.md`). 🔒 **Consent-upgrade** (discloses child data — see `rfc-p1-auth-consent.md` §5) |
| H8 | Entry-fee collection | 3 | M | Uses X15 |
| H9 | Announcements / broadcast | 3 | M | Uses X11 |
| H10 | Submission collection (files/links/forms) | 3 | L | |
| H11 | Submission management | 3 | M | |
| H12 | Judging — rubrics | 3 | L | Moved 4→3 (Rev 5): fairs need basic judging |
| H13 | Judge assignment | 3 | M | Moved 4→3 (Rev 5) |
| H14 | Scoring & aggregation | 3 | L | Moved 4→3 (Rev 5) |
| H15 | Judge accounts / invitations (judge portal) | 3 | M | Moved 4→3 (Rev 5) |
| H16 | Results / rankings publication | 3 | M | Moved 4→3 (Rev 5) |
| H17 | Certificate generation | 3 | M | Moved 4→3 (Rev 5) |
| H18 | Multi-user host org (staff accounts + roles) | 3 | M | 🪝 Uses X5/X6/X7 reserved in P1. Claimed hosts may **opt in** to publicly displaying named team members on their listing (Kaggle-style collaborators; verified `Membership`s + a "display publicly" flag — host-controlled) |
| H19 | Approvals / workflow (registrations, staff) | 3 | M | 🪝 Uses X14 substrate |
| H20 | Host analytics dashboard | 3 | M | |
| H21 | Data export (CSV) | 3 | S | |
| H22 | Sponsor management | Backlog | M | Park |
| H23 | Tracks / divisions management | 3 | M | 🪝 Schema modeled in P1 (see hooks) |
| H24 | Stages / rounds management | 3 | M | 🪝 Schema modeled in P1 |
| H25 | Qualification / advancement rules | 3 | L | 🪝 Schema modeled in P1; regional→state→national chains. Moved 4→3 (Rev 5): core to the fair wedge |
| H26 | Blind judging | 4 | M | Anonymized submissions |
| H27 | Conflict-of-interest / recusal management | 4 | M | Judge COI |
| H28 | Live competition operations + timers | 4 | L | Day-of ops; ties to P21 timers |
| H29 | Multiple judging modes (weighted rubric, ranked/STV, points, consensus, public/popularity vote, screening, gallery) | 4 | L | Market-standard depth (Award Force, Evalato, OpenWater) |
| H30 | Advanced judge assignment (manual / panel / randomized / **auto-match by expertise**) | 4 | M | RocketJudge, zFairs, STEM Wizard |
| H31 | Judge portal UX (queues, deadlines, **side-by-side entry+rubric**, annotate, abstain, progress) | 4 | M | Submittable, Reviewr |
| H32 | **Score normalization / rater calibration** (strict vs. lenient) | 4 | L | ⭐ Differentiator (Reviewr ReviewIQ, Evalato, Devfolio) |
| H33 | Shortlisting / finalist workflows (thresholds, cut-lines, **tie-breaking**) | 4 | M | Reviewr |
| H34 | Advanced blind review (anonymization, **field-level PII redaction**, order randomization) | 4 | M | Expands H26; Reviewr |
| H35 | Public results / winner **gallery & showcase** | 4 | M | Evalato, OpenWater, Award Force |
| H36 | Eligibility pre-screening (submission gating) | 3 | M | Reviewr, Devpost |
| H37 | Advanced submission forms (conditional logic, autosave, large files, nominations) | 3 | M | Expands H5; all awards tools |
| H38 | Plagiarism / duplicate & **anti-fraud reporting** (platform-wide flags) | 3 | M | Submittable, Devfolio; ties DQ4 |
| H39 | Letters of recommendation / references workflow | 4 | M | Reviewr; relevant to scholarship-style comps |
| H40 | Virtual judging suite (interview rooms, scheduled slots, deliberation tools, **mobile floor-judging**) | 4 | L | Expands H28; RocketJudge, STEM Wizard |
| H41 | Participant feedback dispatch (anonymized scores + comments) | 4 | S | ⭐ RocketJudge one-click |
| H42 | Check-in & day-of ops (windows, display/safety approval, **session/schedule builder**) | 4 | M | zFairs, STEM Wizard, OpenWater |
| H43 | Per-event branded microsite + **white-label / custom domain** | 3 | M | Tiered upsell; all tools |
| H44 | Program/edition duplication (clone prior season) | 3 | S | OpenWater, Evalato |
| H45 | AI / automation (auto-score, rules & triggers, AI summaries, fraud detection) | Backlog | L | Submittable; later differentiator |
| H46 | **"Are you the organizer?" claim-interest CTA + host waitlist** on listing pages | 1 | S | Supply-side pipeline from day one; builds the warm R4 launch list (`go-to-market.md` §3–4). Actual claiming stays H1 (Phase 3) |
| H47 | **Award structures** — per-Edition award list (place, monetary/non-monetary/travel-grant, value + currency, display order) managed by hosts; assignment to winners lands with judging (Gate B) | 3 | M | 🪝 `Award` entity reserved in P1 (domain-model, Rev 7); typed prize summary on Edition ships R1 for display |
| H48 | **Listing visibility control** — public / unlisted-by-link / private-invite-only for self-managed competitions (school-internal contests etc.) | 3 | M | Rev 7. Guardrail: **public visibility is NEVER tier-gated** — free tier always includes full public listing (rejects the legacy model; `monetization.md` §1) |

## HC · Host — Compliance, Consent & Advancement *(the K-12 science-fair moat)*

Informed by STEM Wizard, Scienteer (defunct), and zFairs. Keeps the compliance/consent strengths
that made Scienteer sticky while adding the judging/payment/notification stack it neglected.
**Now the Phase-3 anchor** (prioritized 2026-07-07): the science-fair wedge opened by Scienteer's
collapse (see `competitive-analysis.md` §5, `monetization.md` §8).

*🛑 **Design gate:** the entire HC cluster waits for **Gate A — the science-fair wedge deep-dive**
(`development-process.md` §6a): fair-director research first (`go-to-market.md` §3), then RFCs, then
build. Nothing here is designed ahead of that gate.*

| ID | Feature | Phase | Cx | Notes |
|---|---|---|---|---|
| HC1 | Compliance **rules wizard** (questionnaire → required forms; ISEF Forms 1/1A/1B/4) | 3 | L | 🪝 Schema: form-requirements per category. STEM Wizard, Scienteer. Moved 4→3 (Rev 5) |
| HC2 | **Review-committee workflows** (SRC/IRB-style pre-approval gating before work starts) | 3 | L | Scienteer, STEM Wizard, zFairs. Moved 4→3 (Rev 5) |
| HC3 | **Chain-wide once-only parental consent / media release** (account gated until parent e-signs) | 3 | L | 🪝 Extends X3; Scienteer's best feature |
| HC4 | E-signature capture (mobile / emailed link) | 3 | M | Scienteer, zFairs |
| HC5 | **Multi-level advancement, zero re-entry** (school→…→national) + auto-register advancing winners | 3 | L | 🪝 Network lock-in mechanic; zFairs, STEM Wizard. Moved 4→3 (Rev 5) |
| HC6 | Committee sharing/delegation across levels (homeschool/small-school fallback) | 3 | M | Scienteer Force/Allow/Deny. Moved 4→3 (Rev 5) |
| HC7 | **Milestone engine** (deadline-gated, approval-driven, visual status) | 3 | M | STEM Wizard; useful beyond science fairs |
| HC8 | Mass document generation / batch printing; move participant between schools | 3 | S | Scienteer, STEM Wizard. Moved 4→3 (Rev 5) |

## E · Educator / Coordinator *(cross-facet B2B2C growth engine)*

Anchored to **group-registration & multi-org coordination** — the coordinator who manages a
roster (formal chapter, school team, club, or homeschool co-op) across different orgs.
*"Coach/mentor" is the individual-granularity version of this actor, represented as an RBAC
role (X5), not a separate account type or subsystem.*

| ID | Feature | Phase | Cx | Notes |
|---|---|---|---|---|
| E1 | Educator account + verification | 2 | M | |
| E2 | Create / manage roster (cohort) | 2 | M | Uses X8 |
| E3 | Invite students / parents to roster | 2 | M | |
| E4 | Cohort competition discovery (grade-filtered) | 2 | M | |
| E5 | Recommend / assign competitions to students | 2 | M | Drives P29 assignments |
| E6 | Cohort progress & deadline dashboard | 2 | L | Uses X13 |
| E7 | Bulk Participant+ allocation | 2 | M | Uses P15 |
| E8 | Register cohort as team / chapter | 3 | L | Uses H7 — the chapter-registration case |
| E9 | Cohort calendar | 2 | S | |
| E10 | Cohort reporting | 2 | M | |
| E11 | Institutional / seat subscription | 4 | L | 💲 School/district pays |
| E12 | Multi-educator per chapter (roles) | 3 | M | 🪝 Uses X5 |
| E13 | Coach / mentor role (individual mentoring) | 2 | M | RBAC role; 1:few students |
| E14 | Coach/mentor individual progress visibility | 2 | M | Uses X13 |

## PA · Parent / Guardian *(consent holder + primary payer)*

| ID | Feature | Phase | Cx | Notes |
|---|---|---|---|---|
| PA1 | Parent dashboard | 1 (basic) / 2 | M | Basic = manage children + consent (P1); rich = progress + spend (P2) |
| PA2 | Multiple-child management | 1 | M | Uses X2 |
| PA3 | Discover / save competitions for a specific child | 2 | S | |
| PA4 | Parent Participant+ progress visibility | 2 | M | Uses X13 |
| PA5 | Parent approval workflows (purchases, registrations) | 2 | M | Uses X3 + X14 |

## B · Backlog / Parked *(ideas captured, no committed phase)*

| ID | Idea | Notes |
|---|---|---|
| B1 | Colleges as consumers of verified competition records | Extends M20 |
| B2 | Scholarship discovery & matching | Adjacent vertical |
| B3 | Native mobile apps | Web-first until validated |
| B4 | Public API for third parties | |
| B5 | Internationalization / multi-region | Post US-first |
| B6 | Community forums | |
| B7 | Cross-platform leaderboards | |
| B8 | Corporate / sponsor-hosted competitions | |
| B9 | AI recommender chatbot | |
| B10 | Alumni / mentor network | |
| B11 | Host embed badge ("Listed on BeeCompete") | SEO-backlink growth loop, à la Devpost |

---

## Phase-1 Foundation Hooks

**The critical output of this registry.** Built later, but the initial data model **must
reserve room for them now** to avoid a migration. Each feeds the Domain & Data Model doc.

1. **Unified user model with type/role** (X1) — one users table discriminating student/parent/educator/host/admin/judge.
2. **Parent↔child linking** (X2) — guardian relationship is core, not additive.
3. **Organization + Membership + RBAC** (X5, X6, X7) — model orgs, memberships, roles now even though v1 host = one user. Unlocks multi-user host orgs (H18), chapters (E12), coach/judge roles, and approvals without a rebuild.
4. **Roster / Group entity** (X8) — coordinator-managed group; shared by educator cohorts (E2) and team/chapter registration (H7, E8).
5. **Two-level Competition ↔ Edition model** (X9, M5, M6) — evergreen entity vs. yearly instance.
6. **Category templates over a universal spine** (X9) — standardized-yet-flexible schema; *the* core design problem.
7. **First-class competition structure** (X9 → H23/H24/H25) — **divisions/tracks, rounds/stages, and qualification/advancement rules modeled as entities, not flags.** K-12 competitions are routinely multi-division and multi-round with regional→state→national qualification chains. This is a major deepening of the core schema and must be designed in from the start.
8. **Participant ↔ Competition lifecycle state machine** (X23) — a status per user–competition relationship that works for *both* platform-hosted and externally-hosted competitions (M23). Drives the tracker (M8), personal history (M24), and progress. Must exist before the tracker ships in P1.
9. **Append-only activity/event log** (X13) — single source for all progress derivation (P7, P25, E6, PA4) and audit; never bespoke per-feature progress fields.
10. **Approval/status substrate** (X14) — approvable entities carry `status` + audit fields from the start; the workflow engine comes later.
11. **Provenance & confidence as user-facing** (X17, DQ1, DQ3) — every competition record knows its source, freshness, and verification state, surfaced to users and re-verified each annual Edition.
12. **Payer ≠ beneficiary** in payments/entitlements (X15) — parent or educator pays; student holds the entitlement.
13. **Compliance from launch** — affiliate disclosure (DQ10) ships with affiliate links; trust/safety reporting + moderation (DQ7, DQ8) present given minors + any user-generated content.
14. **Compliance/consent/advancement — room, not schema** (HC1, HC3, HC5) — P1 only avoids *blocking* assumptions: stable IDs to hang future tables on; no single-round / single-level assumptions baked into `Edition`. The actual entities are **deliberately designed at Gate A** (`development-process.md` §6a), informed by fair-director research — never ahead of it. Ties to Hook #7 (competition structure).

---

## Open questions to resolve before the Domain & Data Model deep-dive
- **Category set** for launch seeding — which K-12 categories get the first spine + templates?
- **Grade/age representation** — US grade bands vs. age vs. both, for eligibility + filtering.
- **Region granularity** — national / state / district, for filtering and chapter scoping.
- **Division/track representation** — by grade? skill tier? both? And how a participant maps to a division.
- **Round/stage + advancement modeling** — fixed sequence vs. rule-based advancement; how qualification carries across Editions and regions.
- **Team composition** — how a team is represented when registered via a coordinator vs. self-organized.
