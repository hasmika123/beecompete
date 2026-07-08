<!-- Title: Conventional Commit style, e.g. "feat: M8 tracker". Link the issue below. -->

## What & why

<!-- One paragraph. What does this change do, and which registry task / issue does it close? -->

Closes #

## Definition of Done (development-process.md §4)

- [ ] Meets acceptance criteria; happy path + edge cases handled.
- [ ] **Tests**: unit (logic) + integration (API+DB) for new behavior; e2e for critical flows.
- [ ] **Security**: input validated server-side (Bean Validation); authz enforced on the API; no secrets in code.
- [ ] **Compliance** (if it touches user data): consent/privacy respected; no student-data selling/targeting; affiliate disclosure if affiliate links.
- [ ] **Accessibility**: keyboard-navigable, labels, contrast — WCAG 2.1 AA on new UI.
- [ ] **Shared UI**: uses `@beecompete/ui` primitives; no inline SVGs / hand-rolled styles.
- [ ] **Reuse check**: searched `packages/ui` + neighboring modules before creating anything new.
- [ ] **Docs**: registry/ADR/relevant doc updated if scope or a decision changed.
- [ ] **Glossary**: any new name uses the canonical term from `docs/glossary.md`.
