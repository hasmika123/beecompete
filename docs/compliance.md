# BeeCompete — Compliance Map

**Status:** Living document · **Last updated:** 2026-07-06 · **Type:** Reference

> ⚠️ **Not legal advice.** This is an engineering/product map of the regimes that apply to a
> US-first, minors-facing, payments-handling marketplace. **Before public launch, have a qualified
> privacy attorney review** — especially COPPA, the privacy policy, and school contracts. Laws
> change; verify current requirements with counsel.

The short version: because our users are **minors**, we handle **payments**, we run **affiliate +
UGC**, and we may touch **schools**, we sit at the intersection of several regimes. Most are
manageable with good defaults built in from day one (which our architecture already does).

---

## 1. Children's privacy *(the big one)*

| Regime | What it is | What we must do | Kicks in |
|---|---|---|---|
| **COPPA** (+ 2025 amended Rule) | US federal law for under-13 online data | Verifiable **parental consent** before collecting a child's data; clear privacy policy; **data minimization**; parental rights to review/delete; **data-retention limits**; separate consent for any third-party/ad disclosure; reasonable security. | Whenever accounts/PII exist (R2+) |
| **State student-privacy laws** (e.g., California **SOPIPA**, ~130+ state laws) | Restrict K-12-directed online services | **No selling student data. No targeted advertising to students. No profiling** except for the service itself. | Always (we're K-12-directed) |
| **CA Age-Appropriate Design Code** (emerging; modeled on UK Children's Code) | Design duties for services minors access | High-privacy defaults, DPIAs, no dark patterns, age-appropriate design. Partially litigated but signals direction. | Design from the start |

**Practical implication:** the "no selling / no targeted ads to students" rule (SOPIPA-style) is why our **privacy-first, no-ad-tracking analytics** decision isn't just nice-to-have — it's compliance-aligned. And COPPA is why **parent-linked accounts + consent gating** are foundation hooks, not afterthoughts.

### Personalization vs. targeted advertising *(important design line)*
Using a student's own interests + past-competition history to **recommend competitions to that student**
(feature X18) is **permitted** — it's using their data to *deliver and personalize the service for them*
(like any recommendation engine), not prohibited profiling. The line these laws draw is:
- **Allowed:** personalize/operate/improve the service for the student using their first-party data.
- **Restricted:** use that profile for **targeted advertising**, build a profile **for purposes other than the service**, or **sell/share** it.

Where this bites *us* is **paid promotions/sponsored listings to minors** (M28), not the organic recommender.
Rule of thumb for minors:
- **Contextual targeting = safe** — target promotions by *grade / region / category / declared interest*, or by page context.
- **Behavioral targeting = risky** — don't silently build an inferred behavioral profile and use it to place *paid* promotions to a minor (edges into "targeted advertising to students"; the 2025 COPPA update also requires separate parental consent for targeted ads to children).
- **Never** sell or externally share the student profile.

So: personalize organic recommendations freely; keep paid promotions to minors **contextual, not behavioral**. *(Confirm the promotion-targeting approach with counsel.)*

## 2. Educational data (the school path)

| Regime | What it is | What we must do | Kicks in |
|---|---|---|---|
| **FERPA** | Protects student education records at federally-funded schools | If we act as a "school official" handling student records via the educator/institutional path, honor FERPA through a **Data Processing Agreement (DPA)** with the school — use limits, access controls, deletion. | Phase 2 (educators) / Phase 4 (institutional) |
| **State student DPAs** | Many states/districts require a signed student-data-privacy agreement | Be ready to sign standard DPAs (e.g., national SDPC template). | When schools adopt |

## 3. General privacy

| Regime | What it is | What we must do | Kicks in |
|---|---|---|---|
| **CCPA/CPRA** + state privacy laws (VA, CO, CT, TX, etc.) | Consumer privacy rights | Privacy policy, data access/delete/opt-out; **opt-in required to "sell" data of minors under 16** (we won't sell). | As we get users across states |
| **GDPR / UK GDPR + UK Children's Code** | EU/UK privacy | Only if we take EU/UK traffic — lawful basis, consent age varies 13–16, strong child protections. | Post US-first (Phase 4+) |

## 4. Payments

| Regime | What it is | What we must do | Kicks in |
|---|---|---|---|
| **PCI-DSS** | Card-data security | Use **Stripe Checkout/Elements** so card data never touches our servers → we stay in the lightest **SAQ-A** scope. Never store card numbers. | Phase 2 (payments) |
| **Sales tax on digital goods/SaaS** | State economic-nexus tax | Use **Stripe Tax** to calculate/collect where required. | Phase 2 |

## 5. Marketing, consumer & content

| Regime | What we must do | Kicks in |
|---|---|---|
| **FTC endorsement / affiliate disclosure** | Clear, conspicuous **affiliate disclosure** (DQ10) wherever affiliate links appear. | R1 (affiliate links) |
| **CAN-SPAM** | Marketing email: real sender identity, working **unsubscribe**, no deception. | Newsletter (R2+) |
| **FTC "dark patterns"** | No deceptive UX in signup/cancel/consent. | Always |

## 6. Accessibility

| Regime | What we must do | Kicks in |
|---|---|---|
| **ADA Title III / Section 508 / WCAG 2.1 AA** | Build to **WCAG 2.1 AA**. Legally expected for education services, and **schools require accessible vendors** — so it's also a sales gate. | From the start (cheaper than retrofitting) |

## 7. Security & operations

- **Breach-notification laws** (all 50 states): need an **incident-response plan** and the ability to notify. 
- **Reasonable security program**: encryption at rest/in transit, access controls, audit logging, least privilege — already in the architecture.

## 8. Intellectual property (the marketplace lists third parties)

- We display **other organizations' competition names and logos.** Using names factually (nominative fair use) is generally fine; be careful with **logos** and never **imply endorsement/affiliation**. The **beta disclaimer + "unverified/unofficial" labeling** (Trust Tiers) supports this. When in doubt, use text not logos, and honor takedown requests.

---

## Launch compliance gate (non-negotiable before any public release with accounts)
1. Privacy Policy (COPPA-compliant) + Terms + Cookie Policy + affiliate disclosure — **live**.
2. Parental-consent flow working; accounts gated until consent (for any under-13 PII).
3. "No sell / no targeted ads to students" honored (privacy-first analytics ✔).
4. WCAG 2.1 AA baseline on public pages.
5. Incident-response plan + tested backups.
6. **Attorney review of COPPA posture + privacy policy.**

## What lets us launch *earlier* with less burden
A **browse-only marketplace with no accounts collects no personal data**, so COPPA consent flows aren't triggered yet (still need a privacy policy + affiliate disclosure). This is why the release strategy (see `development-process.md`) ships a public browse-only marketplace *before* accounts — real traffic and SEO with a much lighter compliance load.
