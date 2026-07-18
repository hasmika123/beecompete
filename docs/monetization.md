# BeeCompete — Monetization & Packaging

**Status:** Living document · **Last updated:** 2026-07-18 · Depends on: `feature-registry.md`, `competitive-analysis.md`

How we make money without breaking the flywheel. Price points here are **benchmark-informed
hypotheses to validate**, not commitments — flagged 🔬.

---

## 1. Guiding principle

Dashboards are **free for every actor** — they are the engagement flywheel, not the product.
Gating them would starve the audience that makes everything else sellable.

> **Free = discover, track, coordinate — and host privately (capped). Paid = prepare (participant)
> and operate at scale + reach the public audience (host).** *(Host side reworded 2026-07-08 —
> see §2/§4: claiming a curated listing stays free; publishing a self-created competition publicly
> is entitlement-gated.)*

Everything monetizable collapses into **one `Entitlement` abstraction** (Foundation Hook #12):
`{scope: Competition|Edition, beneficiary, payer, product/tier, validity}`. Participant+, host
tools, bulk/cohort purchases, promotion, and renewals are all rows in that model — no separate
"account classes."

## 2. Free vs. paid, by actor

**Participant** — free account + full dashboard; Participant+ is a per-competition *entitlement* on top.

| Free (always) | Participant+ (per competition) |
|---|---|
| Dashboard, browse/search/filter, save/follow | Study plan, practice sets, mock/timed sims |
| Tracker + reminders, **journey/lifecycle status** | Flashcards/spaced-rep, drills, strategy/format training |
| External-registration tracking, personal history, calendar | **Performance analytics**, prep progress |
| Curated resources + affiliate links, recommendations, digests | Full past-papers archive, AI tutoring |

*Split: journey progress (in the competition) = free; prep progress (practice) = paid. Teaser: a sample past-paper + one practice set free to drive conversion.*

**Parent** — everything free; monetizes by buying packages for their kids. Dashboard, multi-child, discover/save-for-child, approvals, progress visibility (populated once a package is owned).

**Educator** — free coordination tools (roster, discovery, assign, cohort dashboard) as the growth wedge; pays only for **bulk Participant+** and, later, **institutional seats**.

**Host** — free presence + capped private hosting; paid = public reach + full operations *(restructured 2026-07-08)*:

| Free host tier | Host tools (per Edition, paid) |
|---|---|
| **Claim/manage a curated listing** + edition, **audience analytics** (views, saves, # tracking, interest by grade/region) | **Public marketplace listing for self-created competitions** (included in every paid tier) |
| Respond to Q&A, basic announcements | Custom forms, team/hierarchical registration, fee collection |
| **Private competitions** (invite-only / link-only): registration, roster, announcements, **submission collection** — with a hard **participant cap** 🔬 and volume limits | Judging suite, advanced analytics, multi-staff, approvals, exports; uncapped volumes |

Two distinct free hooks: (1) hosts of competitions *we* curated see the demand we send them
(audience analytics) — which sells the tools; (2) any host can run a **private** competition free
within caps — which sells capacity and public reach. **A self-created competition cannot be
published publicly for free**: public listing requires a `public_listing` entitlement (part of
every paid tier; see §4). Claiming stays free because the curated catalog is *our* editorial
product — a host suggesting their own competition via DQ15 gets curation on our terms (no
self-serve control, no instant publishing), never a free self-serve public listing.

## 3. Participant+ packaging

- **Unit: per-Competition** (not annual subscription). Aligns cost with value, lowers the barrier, fits the seasonal/deadline-driven nature of competitions.
- **Naming:** the free participant experience is just **Participant**. The paid per-competition package is **Participant+** (launch tier). A future premium tier is **Participant²** ("participant squared" — working name; mock sims, analytics, AI tutoring).
- **Launch:** ship one **Participant+** package per competition; design for **Participant²** later once content depth justifies it.
- **Bulk/cohort:** parents (multi-child) and educators buy N entitlements at a discount and allocate them.
- **Deferred (Backlog):** an **all-access / family annual pass** for power users — only once catalog depth makes a subscription clearly worth it.
- 🔬 **Price hypothesis:** Participant+ **$19–$49** per competition; Participant² **$49–$99**. Validate with a fake-door/price test before building. Parent is payer (Hook #12).

## 4. Host-tools packaging (per Edition, tiered)

> **In one sentence:** free to list, then **pay per competition (per Edition), in tiers**, to run it — with an optional **annual plan** for frequent hosts and **à-la-carte promotion** on top. Not a mandatory subscription; not per-feature à-la-carte.

**Publishing requires host verification** (registry DQ11–DQ14) — a self-submitted listing is not public until the host's identity/legitimacy is established.

Anchored to the **Edition** (a specific running) — reuses the Competition↔Edition model; **"renewal" = buying tools for the next Edition** at a loyalty discount. Market-confirmed model (Evalato prices "per program, valid 365 days"; zFairs per-event/annual).

| Tier | Includes | 🔬 Price hypothesis (per Edition) |
|---|---|---|
| **Free** | Claimed-listing management + audience analytics; **private competitions** (registration, roster, announcements, submissions) with a hard participant cap 🔬 | $0 |
| **Starter** | **+ public marketplace listing** · higher caps, basic submissions at volume | ~$99–$149 |
| **Pro** | + custom forms, fee collection, advanced analytics, multi-staff, approvals, exports, branded microsite | ~$299–$499 |
| **Championship** | + full judging suite (all modes, normalization, blind/COI), results/gallery, certificates, live/virtual judging | ~$799–$1,499 (or annual) |

**Public-listing gate (locked 2026-07-08):** publishing a *self-created* competition to the public
marketplace always requires a **`public_listing` entitlement** — included in **every paid tier**
(Starter+). Whether early Phase-3 hosts get that entitlement free (supply-seeding promo) or pay
from day one is a **Phase-3 pricing decision**; the gate is architecture, the price is config.
Claiming and managing a listing *we* curated remains free (presence ≠ self-serve publishing).
Verification (DQ11–DQ14) is required for anything public regardless of payment.

**Design decisions confirmed by the market (adopt these):**
- **Include unlimited staff & judges** in every tier — don't charge per seat (Award Force/Evalato norm).
- **Volume caps (participants/submissions) as tier boundaries**, not seats.
- **Price for K-12 budgets** — benchmark against **zFairs ($300/event, $1,500/yr)**, NOT the premium awards tools (Award Force $3,250–6,500, Submittable ~$10k). Our hosts are schools, clubs, and small nonprofits.
- **Transparent, self-serve pricing** — nearly every incumbent is quote-only; publishing prices is a trust differentiator.
- **Annual "unlimited editions" option** for frequent/multi-event hosts (matches Judgify Pro Unlimited, zFairs annual).

## 5. Promoted / featured listings (Facet 1 revenue — the audience bundle, monetized)

Hosts pay for **amplified reach** to our participant audience. This is facet 1's primary revenue (affiliate is thin). **Validated by Devpost**, the only researched marketplace selling discrete paid placement (homepage feature + newsletter + featured listings as Marketing tiers); Devfolio stays organic. We adopt Devpost's *inventory* with strict guardrails.

**Five non-negotiable rules (protect discovery trust):**
1. **Relevance gating** — promotion only boosts within genuinely relevant audiences (grade/region/category). Never injects irrelevant results.
2. **Quality/freshness floor** — promotion is a boost factor, not an override; a stale/incomplete listing (per DQ signals) can't buy the top slot. Incentivizes hosts to keep data fresh.
3. **Hard caps + clear labeling** — few, clearly-badged "Promoted" slots; organic dominates.
4. **Extra safety bar** for anything amplified toward minors.
5. **Contextual, not behavioral, targeting for minors** — target promotions by *grade / region / category / declared interest / page context*, **never** a silently-inferred behavioral profile. Behavioral ad-targeting to students edges into restricted "targeted advertising" (SOPIPA-style) and triggers separate parental consent (2025 COPPA). The *organic* recommender (X18) is unaffected — personalizing recommendations *to* the student is permitted. See `compliance.md` §1.

**Inventory (all scoped to an Edition, as `Entitlement`s):** featured search/browse placement · category/homepage spotlight · newsletter/digest inclusion · recommendation boost.

**Pricing:** launch with **flat, time-boxed placement fees per Edition (flights)**; bundle promotion *credits* into Pro/Championship as upsell; move to an **auction/bid (CPC/CPM)** model later once traffic justifies it. **Phase 3+** — no inventory worth selling until the audience exists.

## 6. Entry-fee handling — decision

The market is split: **Award Force, Evalato, zFairs take 0%** (and market it loudly); **Submittable takes 5% + $0.99** (and users resent it).

**Decision (confirmed): 0% of host entry fees** — pass through only payment-processor costs. (a) schools/nonprofits are fee-sensitive and trust-driven; (b) "we keep 0%" is a clean differentiator; (c) we monetize the *tooling + audience*, not the host's revenue. Integrated fee collection is a **Pro-tier feature**, not a rake.

## 7. Revenue streams (priority order)

1. **Participant+ packages** (per competition) — primary revenue #1.
2. **Host tools** (per-Edition tiers) — primary revenue #2.
3. **Promoted/featured listings** — Facet 1 lever, Phase 3+.
4. **Educator/institutional subscriptions** — B2B, Phase 4.
5. **UGC creator marketplace** rev-share — Phase 4 (moved to make room for the science-fair wedge).
6. **Affiliate** on curated resources — minor, ongoing.
7. **Managed-service upsell** ("we help run your competition") — later, à la Devpost/HackerEarth.
8. **Entry-fee collection** — 0% platform cut (feature, not revenue).

## 8. Decisions log

- **Public listing is paid; private hosting is the free tier** (✅ 2026-07-08 — *supersedes* the free-public-listing framing of §2's original table and registry Rev 7's "never tier-gate visibility" guardrail): self-created competitions publish publicly only with a `public_listing` entitlement (included in all paid tiers, Starter+); the free tier = claimed-listing management + capped private competitions (registration, roster, announcements, submissions; participant cap 🔬 TBD). Claiming curated listings stays free; DQ15 self-suggestions get editorial curation only (accepted loophole — curation is our product, not self-serve publishing). Phase-3 launch pricing (charge day one vs. free promo grants) decided at Phase 3; the entitlement gate ships regardless.
- **Entry-fee cut:** ✅ **0%** (confirmed 2026-07-06).
- **Participant tiers:** ✅ free = **Participant**; launch package = **Participant+**; premium (deferred) = **Participant²**. Single package at launch.
- **Science-fair compliance wedge:** ✅ **PRIORITIZED (2026-07-07 — supersedes the 2026-07-06 "hold for Phase 4" decision).** The wedge is now the **anchor of Phase 3**: Host Tools v1 ships science-fair-first (registration + compliance/consent/advancement HC1–HC8 + basic judging H12–H17), targeting the fairs displaced by Scienteer's collapse (TX, AL, LA, ME, MO, VT, VA). Rationale: our own research (`competitive-analysis.md` §5) shows a live, *closing* opening with warm B2B demand — waiting until Phase 4 forfeits it. To make room, the UGC creator marketplace moves to Phase 4. **Non-coding groundwork starts now:** outreach to displaced-state fair directors during Phases 1–2 — plan in `go-to-market.md` §3; the notes feed Gate A (`development-process.md` §6a).
- **Host prioritization:** ✅ paid add-on (promoted/featured listings), Phase 3+.
- **All-access participant pass:** ✅ deferred to Backlog.
- **Still to validate (later):** host tier price points and Participant+ price points via willingness-to-pay tests — no commitment now.
