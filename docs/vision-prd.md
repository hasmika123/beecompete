# BeeCompete — Vision & PRD

**Status:** Living document · **Last updated:** 2026-07-18 · **Type:** Foundational

The "why" behind everything else. Our other docs are strong on *what competitors do* and *how to build it* —
this one states **the user problem, who has it, and how confident we actually are** that it's real.

> ⚠️ **Honesty flag:** the problem below is currently a **hypothesis inferred from market structure**, not
> a fact validated with users. See §3 (Evidence) and §7 (Validation plan). This is the single biggest
> unproven assumption in the whole project — treat it as the thing to de-risk first.

---

## 1. Vision (one line)
**Make discovering, tracking, and preparing for academic competitions as easy as finding a movie to watch —
across every subject, in one place.**

## 2. The core problem
Academic-competition participation is gated by **discovery and coordination friction**, not by lack of competitions:

- Competitions are **scattered** across hundreds of org sites, PDFs, school bulletins, and word-of-mouth. There is **no cross-subject aggregator** — hackathons have Devpost, but math/science/debate/CTSO/arts each live in their own silo.
- Data is **non-standardized**, so you can't easily compare, filter, or find what fits a specific student (grade, region, interest, deadline).
- Participation is **deadline-driven and easy to miss**; there's no unified place to track "what am I doing and when."
- Preparation resources are **fragmented and uneven**, and often behind word-of-mouth.

The result: students (and the parents/educators guiding them) **under-participate** or participate narrowly, simply because they can't easily find and stay on top of the right opportunities.

## 3. Evidence — what we actually know (and don't)
**Basis for believing the problem is real (indirect):**
- The market is **structurally fragmented** — no horizontal aggregator exists at quality (confirmed in `competitive-analysis.md`).
- **Adjacent demand is proven** — Devpost/Submittable-Discover show a free discovery marketplace funneling to paid tools *works* in neighboring spaces.
- Vertical tools thrive per-silo (zFairs, STEM Wizard, Tabroom, CTSO Central), implying real activity and unmet cross-vertical need.

**What we have NOT done (the gap):**
- **Zero primary user research.** No interviews with students, parents, or educators confirming they *feel* this pain, or that discovery (vs. something else) is the real blocker.
- No evidence on **willingness to pay** for Participant+ or host tools.
- No proof the **audience is acquirable** at reasonable cost.

**Conclusion:** the opportunity is credible but **unvalidated with users.** We must not treat competitor-derived confidence as user-validated demand.

## 4. Personas (who has the problem)

**P1 — The Student (primary user).** K-12, motivated by achievement / college admissions / passion. Sub-segments:
- *Elementary (via parent)* — no self-agency; the parent is the actual user.
- *Middle school* — emerging self-drive, still parent/coach-guided.
- *High school* — most self-directed; admissions-motivated.
- **Jobs-to-be-done:** "Find competitions I'm eligible for and interested in," "don't miss deadlines," "know how to prepare and be competitive."
- **Pains:** doesn't know what exists; discovers things too late; unsure how to prep.

**P2 — The Parent/Guardian (gatekeeper + payer).** Wants enriching, resume/admissions-relevant opportunities for their child; is the consent-holder and the one who pays.
- **JTBD:** "Find worthwhile opportunities for my kid," "manage/track it," "give them an edge."
- **Pains:** time-poor; competitions are opaque; hard to vet quality.

**P3 — The Educator/Coordinator (amplifier; Phase 2+).** Teacher/coach/GT-coordinator/co-op leader guiding *many* students across orgs.
- **JTBD:** "Find grade-appropriate competitions for my group," "get my students signed up and tracked."
- **Pains:** juggles many siloed orgs manually; no cross-org cockpit. *(Our most efficient acquisition channel.)*

**P4 — The Host/Organizer (supply side; Phase 3+).** Runs a competition; wants participants + lighter operations.
- **JTBD:** "Fill my competition," "run it without duct-tape tools."
- **Pains:** discovery/reach is hard; incumbent tools are pricey/clunky and bring no audience.

## 5. Why now
Competitions are increasingly **admissions and resume currency**; enrichment spend is high; AI makes standardized data extraction + prep content newly feasible; and a K-12 incumbent (Scienteer) just collapsed, signaling churn.

## 6. Value proposition (the promise, per persona)
- **Student/Parent:** *one place* to discover every kind of competition, filtered to you, with deadline tracking — free — plus optional prep when you want an edge.
- **Educator:** a cross-org cockpit to find, assign, and track competitions for your whole group.
- **Host:** list once and reach a real, relevant audience; run your event with tools priced for schools.

## 7. Validation plan *(do this to de-risk §3 — before heavy R2 investment)*
The releases already give us a staged test, but **traffic ≠ validated demand**. Add deliberate discovery:
1. **Problem interviews (do first):** 8–12 conversations each with students, parents, and educators — *before* concluding discovery is the core pain. Cheap, highest-signal.
2. **R0 waitlist / landing test:** a value-prop landing page; measure signup conversion from real traffic (demand signal).
3. **R1 (browse-only) behavior:** are people searching, filtering, returning? SEO traction? (engagement signal).
4. **R2 tracker adoption + retention:** do users save/track and come back on deadlines? (the stickiness bet).
5. **Willingness-to-pay probes (before Phase 2):** fake-door/price tests for Participant+.
> **Gate:** if problem interviews + R1 signals don't support the discovery thesis, revisit scope *before* investing in R2's compliance-heavy account system.

## 8. Success metrics
- **North Star (early):** # students *actively tracking* ≥1 competition (engagement, not vanity signups).
- **Leading signals:** waitlist conversion · R1 organic traffic & return rate · tracker adoption · deadline-reminder engagement.
- **Later:** Participant+ conversion & willingness-to-pay · host adoption · educator cohort size (viral coefficient).

## 9. Non-goals (scope discipline)
- Not building prep content depth or host/judging tools at launch (later phases).
- Not "everything for everyone" on day one — broad *spine*, depth-on-demand (see strategy).
- Not a social network; not a general education platform.

## 10. Key assumptions & risks
- **A1 (biggest):** students/parents experience discovery as a real, felt pain → *validate via §7.*
- **A2:** the audience is acquirable affordably (SEO + educators) → *watch R1 traffic/CAC.*
- **A3:** enough will pay for Participant+/host tools → *probe before Phase 2.*
- **A4:** we can seed & maintain a high-quality cross-vertical catalog sustainably → *see phase-1-plan seeding workstream.*

## 11. Relationship to other docs
This is the "why." `feature-registry` = what · `domain-model`/`architecture` = how · `monetization` = money ·
`competitive-analysis` = market · `compliance` = legal · `phase-1-plan` = build order.
