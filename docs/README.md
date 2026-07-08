# BeeCompete — Planning Docs Index

The planning corpus. Read order for a newcomer is top-to-bottom; day-to-day, jump by need.

## Start here
| Doc | What it answers |
|---|---|
| [vision-prd.md](vision-prd.md) | **Why** — the user problem, personas, the biggest unvalidated assumption |
| [glossary.md](glossary.md) | **Ubiquitous language** — the canonical name for everything (read before writing anything) |

## Strategy & money
| Doc | What it answers |
|---|---|
| [competitive-analysis.md](competitive-analysis.md) | The market: 13+ incumbents, pricing, the science-fair wedge |
| [monetization.md](monetization.md) | How we make money; the locked decisions log |
| [go-to-market.md](go-to-market.md) | Demand: channels per release, wedge outreach, validation gate |

## What we're building
| Doc | What it answers |
|---|---|
| [feature-registry.md](feature-registry.md) | **Every feature, every phase** — the single source of scope + the 14 foundation hooks |
| [domain-model.md](domain-model.md) | The data model; the locked modeling decisions (grade, division, regions, soft-delete) |
| [compliance.md](compliance.md) | The legal map (COPPA, FERPA, PCI, WCAG…) and the launch gate |

## How we're building it
| Doc | What it answers |
|---|---|
| [architecture.md](architecture.md) | Stack, topology, cross-cutting concerns, the ADR log |
| [rfc-p1-auth-consent.md](rfc-p1-auth-consent.md) | Phase-1 deep dive: auth, sessions, COPPA consent, RBAC |
| [development-process.md](development-process.md) | Branching, the two-tier per-feature loop, the 🛑 Phase-3 design gates, releases |
| [setup-runbook.md](setup-runbook.md) | Manual external setup (accounts, DNS, VPS, Postgres, legal entity) |
| [phase-1-plan.md](phase-1-plan.md) | The ordered, buildable task list for R1 + R2 |

## Design
| Doc | What it answers |
|---|---|
| [design-brief.md](design-brief.md) | Aesthetic direction, locked palette/type, per-page input |
| [page-blueprints.md](page-blueprints.md) | Structural specs for Landing / Competitions / Details (approved) |

## Conventions
- Docs cite each other by filename; decisions carry a **date** and supersede explicitly.
- If a term isn't in the glossary, add it there first, then use it.
- 🛑 **Design gates:** judging and the science-fair system are *not designed ahead* — see development-process.md §6a.
