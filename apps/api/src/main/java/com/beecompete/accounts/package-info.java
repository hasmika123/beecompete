/**
 * {@code accounts} module — users, guardianship, orgs, membership, RBAC, consent
 * (architecture §4).
 *
 * <p>Owns its entities, services, and API. Cross-module calls come in through this
 * module's service interfaces only — never reach into another module's internals.
 *
 * <p>Skeleton (F2): package marker only. Auth/consent schema + flows land in R2
 * (see {@code docs/rfc-p1-auth-consent.md}). 🛑 Consent/guardian logic is
 * compliance-gated — build it deliberately, server-side-validated.
 */
package com.beecompete.accounts;
