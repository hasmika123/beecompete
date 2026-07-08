# BeeCompete — Glossary (Ubiquitous Language)

**Status:** Living document · **Last updated:** 2026-07-08

The single source of truth for **what we call things**. Every other doc, conversation, UI label,
and eventually every table/field name uses these exact terms. When a term has tempting synonyms,
the **canonical** term is bolded and the synonyms-to-avoid are listed so we stay consistent.

> Rule: if you're about to invent a new word for something already defined here, use the term
> here instead. If a genuinely new concept appears, add it here first, then use it.

---

## Core competition model

| Term | Definition | Notes |
|---|---|---|
| **Competition** | The *evergreen* entity — the competition as an ongoing thing (e.g., "AMC 10", "Congressional App Challenge"). Owns identity, description, category, resources, reviews, history. | Does **not** own dates — those live on the Edition. |
| **Edition** | One *specific running* of a Competition (e.g., "AMC 10 — 2026"). Owns dates, registration, fees, results. Recurs (usually annually). | Avoid "instance", "event", "season" as the canonical term. |
| **Category** | Where a Competition sits in our taxonomy (e.g., Math, Robotics, Debate, Science Fair). | Drives browse/filter and which Category Template applies. |
| **Category Template** | The category-specific set of fields layered on top of the universal Spine (e.g., Science Fair adds ISEF-form fields). | The mechanism that makes the schema "standardized yet flexible". |
| **Spine** | The universal set of fields every Competition shares regardless of type (identity, format, eligibility, timeline, cost, rewards). | See `feature-registry.md` X9. |
| **Division** (a.k.a. **Track**) | A parallel bracket *within* a Competition that participants are sorted into — usually by grade, age, or skill (e.g., Junior vs. Senior division). | Distinct from Category. Participants compete within a Division. |
| **Round** (a.k.a. **Stage**) | A sequential phase of an Edition (e.g., qualifier → regional → final). | An Edition has one or more Rounds. |
| **Advancement** | Moving a participant/team from one Round or fair level to the next (e.g., school → regional → state → national). | "Qualification" = the *rule* that decides advancement. |
| **Format** | How a Competition runs: participation mode (individual / team / both), delivery (in-person / virtual / hybrid), and evaluation type (submission / exam / live-performance / interview / portfolio). | |
| **Eligibility** | Who may enter — grade/age band, region, school type, other criteria. | Age rules may be anchored to an **age cutoff date** ("under 19 as of June 1"). |
| **Entry Pathway** | *How* you enter a Competition: **individual** (register yourself), **school/chapter** (only through a participating school or chapter — e.g., MATHCOUNTS, AMC), or **either**. | Spine column + filter facet (2026-07-08). Distinct from Eligibility (who may enter). |
| **Award** | A defined prize on an Edition — place, type (monetary / non-monetary / scholarship / travel grant), value + currency. | Reserved entity (→ H47). The card/at-a-glance "Prize" renders the Edition's typed prize summary. |

## People (actors)

| Term | Definition | Notes |
|---|---|---|
| **Participant** | A student who discovers, tracks, and competes. Also the name of the **free** participant experience. | Canonical for the person *and* the free tier. |
| **Member ID** | A user's public BeeCompete handle (reserved on `User`, 2026-07-08). Team/roster invites go by Member ID so a minor's email is never exposed. | → H7/M18 (Phase 3). |
| **Parent / Guardian** | The adult linked to a minor Participant — holds consent, pays, and oversees. | Primary payer. |
| **Educator** (a.k.a. **Coordinator**) | An adult who manages a Group of participants across competitions (teacher, club sponsor, GT coordinator, homeschool co-op leader). The B2B2C growth actor. | Anchored to *group registration + multi-org coordination*. |
| **Coach / Mentor** | The same actor as Educator but at *individual* granularity (guides a few students). Represented as a role, not a separate account. | Not a distinct account type. |
| **Host** (a.k.a. **Organizer**) | The party that owns a Competition listing and runs its Editions using host tools. | Canonical: **Host**. |
| **Judge** | A person invited to evaluate submissions/participants in an Edition. A role, not an account type. | |
| **Content Creator** | A third party who sells prep content in the UGC marketplace (Phase 4). | |
| **Sponsor** | A company/organization that pays to reach the participant audience (sponsored competitions/prizes/categories). | Deferred revenue lever; modeled as an Organization. |
| **Admin / Curator** | Internal BeeCompete staff who seed data, verify hosts, and moderate. | |

## Organizations & groups *(easily confused — read carefully)*

| Term | Definition | Notes |
|---|---|---|
| **Organization** | Any institutional party: a Host org, a school, a sponsor company. Generic on purpose. | A Sponsor is an Organization with type = sponsor; a school is type = school. Keeping this generic is what lets "free for schools" and "sponsorship" be enabled later. |
| **Membership** | The link between a User and an Organization, carrying a Role. | Enables multi-user host orgs, chapters. |
| **Role** | A permission set within an Organization (owner, staff, judge, coach, etc.). RBAC. | |
| **Group** (a.k.a. **Cohort**, **Roster**) | A set of Participants managed by an Educator (a class, club, or co-op). "Roster" = its membership list. | The generic coordinator-managed set. |
| **Team** | A set of Participants who enter a Competition *together as one unit*. Competition-scoped. | Distinct from Group — a Group may form several Teams. |
| **Chapter** | A *persistent, formally-affiliated* Group tied to an Organization (e.g., a school's DECA chapter). | A specific kind of Group + Organization link. May be a **host-affiliated network chapter** (CTSO-style: join codes, founding applications, lead/co-lead/mentor/student roles), not only educator-created (2026-07-08). |

## Participant-facing concepts

| Term | Definition | Notes |
|---|---|---|
| **Marketplace** (a.k.a. **Discovery**) | Facet 1 — the free browse/search/explore experience over all Competitions. | The audience-acquisition engine. |
| **Tracker** ("My Competitions") | The free dashboard where a Participant follows saved competitions, deadlines, and status. | Stickiest retention feature. |
| **Journey** (a.k.a. **Lifecycle**) | The status of a Participant's relationship to a Competition: saved → registered → preparing → submitted → completed → result. Works for platform-hosted *and* external competitions. | Foundation Hook #8. **Journey progress = free**; prep progress = paid. |
| **External Registration** | When a Participant registers on the *host's own* site (competitions we list but don't host). We track that they did. | vs. on-platform registration via host tools. |
| **Participant+** | The **paid, per-Competition** prep package (launch tier). | Scoped to one Competition. |
| **Participant²** | The deferred **premium** prep tier ("participant squared" — mocks, analytics, AI tutoring). Working name. | Not built at launch. |
| **Resource** | A curated prep/reference link on a listing (book, past paper, guide), often with an affiliate link. | Content model #1. |
| **Weekly Digest** | The free weekly email listing *new competitions matching the subscriber's preferences* (grade, category/interests, region), collected at signup. The R1 email-capture product (→ R1-15, Brevo). | Canonical UI label. Avoid "newsletter", "subscription", "mailing list". Distinct from *Promotion* digest inclusion (paid placement inside this send, Phase 3+). |
| **Article** | An **admin-published** piece of content (rich text, images, links) that can **link Competitions**, rendered in-article as CompetitionCards. Canonical entity name (→ M19, Phase 2). | Public surface is labeled **Community**; code/schema/docs always say Article. Avoid "blog post", "forum post", "thread". **Never user-authored** — forums (B6) stay deferred and separate. |
| **Community** | The public-facing **label** for the Article surface (nav item + `/community` article index and detail pages). A UI name, not an entity. | UI copy says Community; everything internal says Article. |
| **Reaction** | A like or love on an Article by a **logged-in, non-minor** user; one per user per Article (changeable). | → M34. Counts are public; *who* reacted is never shown. Minors and logged-out users see counts only. Share is not a Reaction (plain link action, no login, no data). |
| **Article Comment** | A text comment on an Article by a **logged-in, non-minor** user; moderated via DQ8, reportable via DQ7. | → M35 🔒. Adult-authored only — no child UGC. Builds after R2 accounts + DQ8 exist. |

## Host-facing concepts

| Term | Definition | Notes |
|---|---|---|
| **Host Tools** | Facet 3 — the paid suite to *operate* an Edition (registration, submissions, judging, results). | Sold per Edition, in tiers. |
| **Listing** | A Host's published Competition record on BeeCompete. | Seeded by us, then Claimed; or self-submitted (Phase 3). |
| **Claim** | A Host verifying identity to take ownership of a listing we seeded. | Gate = Host Verification. |
| **Submission** | A participant's entry to an Edition (files/links/forms). | |
| **Rubric** | The scoring criteria (often weighted) judges use. | |
| **Judging Mode** | The evaluation method: weighted-score, ranked-choice/STV, points, consensus, public vote, screening, gallery. | See `competitive-analysis.md` §3. |
| **Promotion** (a.k.a. **Featured Listing**) | A paid, labeled, capped visibility boost for an Edition (search/spotlight/digest/rec). | Facet-1 revenue. Distinct from Sponsorship. |
| **Verification / Trust Tier** | A listing's trust state: **Curated → Claimed → Verified → Unverified**. Shown to users. | Anti-scam; see registry DQ11–DQ14. Surfaced as **maintainer attribution**: "Listing *maintained by* BeeCompete Curation Team" (curated) → host org (claimed+). Never "managed by" — the organizer runs the competition; the maintainer keeps the *listing* accurate. |

## System, money & data

| Term | Definition | Notes |
|---|---|---|
| **Facet** | One of the three product pillars: Facet 1 = Marketplace, Facet 2 = Participant+, Facet 3 = Host Tools. | |
| **Entitlement** | A record granting access to a paid Product, scoped to a Competition or Edition. The one abstraction behind all purchases. | `{scope, beneficiary, payer, product/tier, validity}`. |
| **Payer vs. Beneficiary** | The party who *pays* (parent, educator, host, sponsor) can differ from who *holds* the benefit (student, host org). | Foundation Hook #12. |
| **Product / Tier** | A purchasable thing and its level (Participant+, host Starter/Pro/Championship, Promotion). | |
| **Provenance** | The origin + verification metadata on a data record (source, freshness, confidence). | Powers Trust Tiers. |
| **Event Log** (a.k.a. **Activity Log**) | The append-only record of things that happened; the single source all *progress* is derived from. | Foundation Hook #9. Never store bespoke progress fields. |
| **HeroCard** | One of the **three admin-managed image cards** in the Landing hero's right half (1 main + 2 satellites): image, position, and — main card — a link + short description shown on a hover scrim. | → M36, R1-1 schema, R1-3 admin CRUD, R1-6b render. Avoid "banner", "hero image". |
| **FeaturedSlot** | An **admin-picked, ordered** entry in the Landing "Featured Competitions" carousel, pointing at a Competition. | → M36. Editorial picks; distinct from **Promotion** (paid, labeled — M28, Phase 3). |

## Compliance & K-12

| Term | Definition | Notes |
|---|---|---|
| **Consent** | A recorded parental/guardian approval (COPPA), including the chain-wide media release for competitions. | Account gated until given. |
| **Compliance Forms / Rules Wizard** | The engine that asks a participant questions and determines which official forms (e.g., ISEF Forms) are required. | Registry HC1. |
| **Review Committee** | An SRC/IRB-style body that must approve certain projects *before* work begins. | Registry HC2. |
| **Milestone** | A deadline-gated, approval-driven step in a participant's structured workflow, with visible status. | Registry HC7. |

## Phases (build sequence)

| Term | Meaning |
|---|---|
| **Phase 1** | Marketplace MVP (discovery, tracker, accounts + consent, curated/affiliate resources). |
| **Phase 2** | Participant+ v1 + Educator dashboard + Parent tools. |
| **Phase 3** | Host Tools v1 — science-fair wedge first (host verification, registration, K-12 compliance/consent/advancement, basic judging). |
| **Phase 4** | Advanced judging suite, UGC creator marketplace, institutional subscriptions, expansion. |

---

## Naming — locked (2026-07-06)
Canonical terms confirmed:
- **Edition** (not "instance"/"event") for a specific running of a Competition.
- **Group** (not "Roster"/"Cohort") for an Educator-managed set of participants.
- **Host** (not "Organizer") for the party running a competition.
- **Participant²** as the working name for the premium prep tier.
