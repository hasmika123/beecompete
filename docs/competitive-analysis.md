# BeeCompete — Competitive Analysis: Judging & Competition-Management Platforms

**Status:** Living reference · **Last updated:** 2026-07-06 · **Type:** Reference

Primary-source research (official sites, help docs, G2/Capterra) across 10 platforms in 4
clusters. Purpose: (1) ensure our **paid host tools** match or beat incumbents, (2) benchmark
**pricing/monetization**, (3) inform the **promoted-listing** model. Feeds `feature-registry.md`
(H/HC items) and `monetization.md`.

---

## 1. The landscape (4 clusters)

| Cluster | Tools | Relevance to us |
|---|---|---|
| **Live/event judging** | RocketJudge | In-person science-fair/expo judging — directly K-12 |
| **Awards/submission mgmt** | Award Force, Evalato, OpenWater, Submittable, Reviewr, Judgify | The deep judging/scoring feature bar |
| **K-12 fair management** | STEM Wizard, Scienteer (defunct), zFairs | Our beachhead's incumbents; compliance + advancement |
| **Hackathon hosting** | Devpost, Devfolio, HackerEarth | Discovery marketplace + promoted-listing mechanics |

**None of them have a participant-side audience/prep marketplace.** Every one is a pure host/organizer
tool. Our free discovery marketplace + Participant+ prep + cross-domain breadth is unclaimed territory.
Submittable's "Discover" is the closest anyone comes — and it's *free*, funneling applicants to paying
customers, which validates our core flywheel.

## 2. Pricing benchmark

| Tool | Model | Published price | Entry-fee cut | Users/judges | Free tier |
|---|---|---|---|---|---|
| **Award Force** | Per-program, annual | $3,250 Growth / $6,500 Pro / custom | **None** (differentiator) | Unlimited | Demo only |
| **Evalato** | Per-program, **valid 365 days** | €900–€5,500 / program + custom | **0%** | Unlimited | Free until "go live" |
| **Judgify** | Per-event (or annual unlimited) | Free / **$699 event** / $2,399 yr / custom | Via Pro+ | — | Free (100 subs) |
| **Submittable** | Quote, annual tiers | ~$10k/yr entry | **$0.99 + 5%** per paid submission | 5 perm levels | No (Discover free) |
| **OpenWater** | Quote, annual | ~$5,100/yr start | Configurable | Role-based | No |
| **Reviewr** | Quote, 3 tiers | Not published | — | Granular | Free trial |
| **RocketJudge** | Quote | **max(judges, competitors)** | — | — | ≤10 participants + 1 free event/yr |
| **zFairs** | Per-event / annual, by org level | **$300/event · $1,500/yr · ~$499/mo ent** (transparent) | Organizer collects per-entry | All roles | No |
| **STEM Wizard** | Quote, annual, 2 tiers | Not published (School vs Regional/State) | Fairs collect per-project fees | Roles | No |
| **Scienteer** ⚠️defunct | Ad-supported + voluntary | ~$1,000/yr per regional (removes ads) | No (mailed checks) | Roles | Free to students |
| **Devpost** | Sponsor-funded/quote | Not published | Handles global payouts | Judge accounts | **Free for students** |
| **Devfolio** | Quote (business) | Not published | Crypto/quadratic options | — | **Free for universities** |
| **HackerEarth** | SaaS + recruiting | ~$99–$279/mo; Sprint ~$169+ | — | — | Trial |

**Patterns that matter for us:**
1. **Per-program / per-event flat fee, valid ~365 days, is the dominant model** — Evalato literally prices "per program, valid 365 days." This *is* our per-Edition + renewal model. Confirmed as market-standard.
2. **Unlimited users/judges included** (Award Force, Evalato) — the category is moving away from per-seat. We should include unlimited staff/judges in host tiers.
3. **Volume caps (entries/participants) are the tier levers** — not seats. Grow-50 vs Grow-200 vs Pro-10,000.
4. **Entry-fee cut is split**: Award Force/Evalato take **0%** and market it loudly; Submittable takes **5% + $0.99**. A real positioning decision (see `monetization.md`).
5. **Free for students/universities is universal** in the hackathon world — supports our free host tier.
6. **Most enterprise pricing is quote-only** — opaque pricing is a common complaint and an opening for us to be transparent.
7. **Dual monetization** (STEM Wizard): org license + platform collects participant entry fees. We can do both.

## 3. Master feature checklist for paid host tools

Legend: ✅ market-standard (we must have) · ⭐ differentiator (few have it; competitive edge) · registry ID.

**Submission & forms**
- ✅ Drag-drop form builder, conditional/branching logic, autosave/save-resume, large-file uploads → H37
- ✅ Eligibility pre-screening / pre-qualification → H36
- ✅ Nominations support → H37
- ⭐ Plagiarism/duplicate detection + platform-wide anti-fraud flags (Submittable, Devfolio) → H38
- ✅ Collaborator/co-author invites (team submissions) → H7

**Judging**
- ✅ Multiple judging modes: weighted rubric scoring, **ranked-choice/STV**, points allocation, consensus/qualifying, **public/popularity voting**, approve-reject screening, gallery → H29
- ✅ Judge assignment: manual 1:1, panel/committee, randomized, **auto-match by expertise/subject/availability** → H30
- ✅ Judge portal: personal queues, deadlines, progress, **side-by-side (entry+rubric)**, annotation, **abstain** → H31
- ⭐ **Score normalization / rater calibration** (Reviewr ReviewIQ, Evalato, Devfolio) — corrects strict/lenient judges → H32
- ✅ Multi-round (fixed/rolling/always-open; horizontal & vertical structures) → H24
- ⭐ Blind review depth: anonymization, **field-level PII redaction**, **submission-order randomization** → H34
- ⭐ **COI enforcement *before* access** + recusal/abstain (Reviewr = gold standard; Award Force has NONE) → H27
- ✅ Shortlisting/finalist workflows: thresholds, cut-lines, **tie-breaking rules** → H33

**Results & recognition**
- ✅ Winner-selection engine, real-time leaderboard/score matrix → H16
- ✅ Public results/winner **gallery & showcase** → H35
- ✅ Certificates → H17
- ⭐ One-click **anonymized participant feedback** dispatch (scores + comments) → H41

**Live & virtual judging**
- ⭐ Video **interview rooms**, scheduled judge interview slots (Zoom-style), deliberation tools (screen-share, whiteboards, shared notes) → H40
- ⭐ **Mobile floor-judging** (phone ballots at in-person events) → H40
- ✅ Check-in / day-of ops (windows, display & safety approval), **session/schedule builder** → H42

**Payments & platform**
- ✅ Entry-fee collection, member/non-member & tiered pricing, coupons, multi-currency, refunds → H8
- ✅ Multi-user org accounts + granular role-based permissions → H18
- ✅ Email automation/templates, bulk + individual messaging, reminders → H9
- ✅ Analytics/reporting + export (CSV/PDF/Excel) → H20/H21
- ⭐ Per-event **branded microsite + white-label / custom domain** (higher tier across all) → H43
- ✅ **Program/edition duplication** (clone last season) → H44
- ⭐ AI/automation: auto-scoring, rules & triggers, AI reviewer summaries, ML preference training, fraud/document verification (Submittable) → H45 *(Backlog)*
- ✅ Integrations / API / SSO → (B4 / X4)

**K-12 compliance & advancement (the science-fair moat — STEM Wizard & Scienteer)**
- ⭐ **Compliance "rules wizard"**: questionnaire auto-determines required forms (ISEF Forms 1/1A/1B/4 etc.) → HC1
- ⭐ **SRC/IRB-style review-committee workflows** with **pre-approval gating before experimentation** → HC2
- ⭐ **Parental-consent gating** — account inactive until parent e-signs; **chain-wide once-only consolidated consent/media release** (Scienteer's best feature) → HC3
- ⭐ E-signature capture (mobile / emailed link) → HC4
- ⭐ **Multi-level advancement with zero re-entry** (school→district→regional→state→national) + auto-registration of advancing winners → HC5
- ⭐ Committee sharing/delegation across levels (homeschool/small-school fallback) → HC6
- ⭐ **Milestone engine** — deadline-gated, approval-driven student workflow with visual status → HC7
- ✅ Mass document generation / batch printing; move participant between schools → HC8

## 4. Weaknesses to exploit (their pain = our opening)

- **Steep learning curve / clunky setup** — cited for Award Force, OpenWater, Submittable. → Win on onboarding & UX.
- **Weak in-app reporting** ("export to Excel") — Award Force, OpenWater. → Native dashboards.
- **Clunky judge assignment** for complex judge/entry combos — Award Force. → Better assignment UX + auto-match.
- **Poor notifications** — Scienteer required users to "log in daily"; no reviewer email alerts. → Solid notification engine (we have X11/X12).
- **Opaque pricing** — nearly all are quote-only. → Transparent, self-serve pricing as a trust signal.
- **No COI mechanism** — Award Force. → Ship COI enforcement.
- **No participant audience** — all of them. → Our structural moat.

## 5. Strategic findings & openings

1. **The audience bundle is unclaimed.** Every incumbent is a pure host tool with no participant marketplace. Our free discovery + prep audience is a differentiator none can replicate quickly, and Submittable Discover proves the model works.
2. **Scienteer's collapse = a live market opening.** It was the official system for **TX, AL, LA, ME, MO, VT, VA** (21k+ users, 600+ schools) and just **lapsed its domain and got displaced by STEM Wizard** (Texas). The other states may be in transition *right now*. Its lesson: it proved demand for near-free deep ISEF-compliance + elegant parental consent, but **died from neglecting judging, payments, notifications, and business continuity**. A product that keeps its compliance/consent strengths and adds the full judging/payment/notification stack — plus our audience — could capture displaced fairs. High-value niche wedge *within* broad K-12, with weak/failing incumbents and timely urgency. **(Decision 2026-07-07: adopted — the wedge is now the Phase-3 anchor; see `monetization.md` §8, registry Rev 5.)**
3. **Network lock-in via advancement is real and powerful.** STEM Wizard auto-promotes winners between fair levels *only if both fairs are customers* — a land-and-expand mechanic that pressures feeder/parent fairs to adopt. We should design advancement (HC5) the same way.
4. **Promoted listings are a proven, discrete revenue product — but only Devpost sells them.** Devpost sells homepage feature + newsletter placement + featured listings as tiered **Marketing add-ons** stacked on hosting. Devfolio stays organic (chronological + post-event star ratings); HackerEarth bundles promotion into managed services. This validates our labeled/capped/relevance-gated promotion model (see `monetization.md`) and shows the specific inventory (homepage, newsletter, featured slot) that converts.
5. **Managed-service upsell exists** (Devpost, HackerEarth run events for you). A future premium "we help run your competition" offering is viable once tooling is mature.
6. **Avoid two of their models for a minor-facing product:** ad-supported free tiers (Scienteer — and ads to minors are a non-starter) and recruiting/talent-funnel monetization (HackerEarth — inappropriate for K-12). Our revenue is packages + host tiers + promotion + optional entry-fee handling.

## 6. Condensed per-tool profiles

- **Award Force** — Premium awards SW. Judging Suite: combinable modes incl. **STV**, tag-filtered panels, weighted criteria, blind judging, score matrix. Flat annual per-program ($3,250–$6,500), unlimited users, **no fee cut**. Gaps: no COI, weak reporting, steep setup. `awardforce.com`
- **Evalato** — 6 judging modes (score/popularity/simple/points/STV/positional), **score normalization**, multi-round. Per-program 365-day pricing (€900–€5,500), **0% fee cut**, unlimited users/judges, 40+ languages. `evalato.com`
- **OpenWater** — Awards + abstracts/conferences + grants + scholarships. Weighted scoring, **ranking judging**, blind + anonymize, session builder, certificates. Quote ~$5,100/yr. Steep learning curve. `openwater.com`
- **Submittable** — Forms + multi-stage review + payments, as awards/grants/submissions. **AI/ML review, fraud detection, funds disbursement**, side-by-side reviewer UX, **free Discover marketplace**. Quote ~$10k/yr + **$0.99+5%** per paid submission. `submittable.com`
- **Reviewr** — Scholarships/grants. **COI enforcement before access**, **ReviewIQ normalization**, order randomization, field-level redaction, **letters of recommendation**, tie-breaking, full post-award lifecycle. Quote, free trial. `reviewr.com`
- **Judgify** — Awards/abstracts. Custom scoring formulas, multi-round + public voting, whitelabel. **Transparent pricing**: free / $699 event / $2,399 yr. `judgify.me`
- **RocketJudge** — Live/in-person judging. **Auto judge↔competitor matching**, mobile floor ballots, **video interview rooms**, one-click anonymized feedback. Quote on max(judges, competitors); free ≤10. Fits K-12 science fairs. `rocketjudge.com`
- **zFairs** — Most **transparent pricing** ($300/event · $1,500/yr · ~$499/mo ent) and broadest scope (science/history/art/robotics/theater). Strongest **automated multi-level advancement ("Promotion")** with no re-registration; ISEF forms + e-sign + SRC workflows; **SMS**, built-in video conferencing, hybrid support; organizer collects per-entry fees. The K-12 feature+pricing benchmark. `zfairs.com`
- **STEM Wizard** — "Worldwide leader in science-fair mgmt." **ISEF Rules Wizard**, Form Central, SRC/IRB, **milestone engine**, judge management + scoring, Zoom judging slots, **auto-advancement between fair levels**, per-fair subdomains. Quote annual (School / Regional-State). Now displacing Scienteer. `stemwizard.com`
- **Scienteer** ⚠️ **DEFUNCT** — "Tax-software" ISEF compliance, best-in-class **chain-wide parental consent**, 4-level auto-advancement. **No judging module, no payments, poor notifications.** Domain lapsed 2026; displaced by STEM Wizard. Cautionary tale + market opening. `scienteer.com` (dead)
- **Devpost** — Largest hackathon marketplace (4M+ builders). Hosting + judging + **global prize payout** + **paid promoted placement** (homepage/newsletter/featured as Marketing tiers). Free for students; sponsor-funded. `devpost.com`
- **Devfolio** — Student/Web3 hackathons. Judging w/ **auto score normalization**, **platform-wide plagiarism flag**, quadratic voting. **Organic discovery** (no paid featuring). Free for universities. `devfolio.co`
- **HackerEarth** — Managed hackathons tied to **developer recruiting**. FaceCode live interviews, auto-evaluation. ~$99–$279/mo + Sprint. Weakest discovery. `hackerearth.com`

## 7. Adjacent K-12 vertical tools (broad-beachhead relevant)

Because our beachhead is *broad* K-12, these vertical-specific incumbents matter — each owns one
slice, none spans verticals (our differentiator), and several intersect the educator/chapter angle:

- **CTSO Central** (`ctsocentral.com`) — purpose-built for **DECA, FBLA, HOSA, BPA, SkillsUSA, TSA, FCCLA, FFA**: membership, conference registration/payments/housing/check-in, **live electronic judging, custom rubrics, side-by-side scoring, rounds/brackets, online testing**, analytics, API/Zapier. New (off waitlist ~2026). Directly serves the formal-chapter world we anchored the educator angle to.
- **Tabroom** (`speechanddebate.org/tabroom`) — NSDA-operated, dominant **speech & debate** tournament system (pairings, online ballots, results). **Free to run tournaments**; **NSDA Campus** virtual rooms **$8/room/day** (no observers) / **$14** (with). Directors set entry fees.
- **MAA AMC portal** — AMC math competitions run via a school **Competition Manager**; MAA-operated (not licensable SaaS). Fees ~$75 regular / ~$115 late (2026-27).
- **MATHCOUNTS** — self-operated Chapter→State→National middle-school math pipeline.
- **FairEntry** — dominant for **county/agricultural fairs & 4-H** (entry, judging, billing, awards). Adjacent "fair" ops.
- **EdsCave Science Fair Manager** — lightweight/free single-fair tool.

**Takeaway:** every K-12 vertical (science, CTSO, debate, math, ag) is served by a *separate* specialized
tool. A cross-vertical platform with standardized data + a shared participant audience is genuinely
differentiated — no incumbent competes horizontally. This is the strategic case for our breadth.

---

*Sources are linked inline in the research transcripts; key pricing anchors verified against official pricing/help pages where published (Evalato, Judgify, Award Force, zFairs, Tabroom) and third-party aggregators where quote-only.*
