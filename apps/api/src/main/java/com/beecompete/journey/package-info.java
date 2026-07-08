/**
 * {@code journey} module — participant↔competition lifecycle plus the append-only
 * {@code ActivityEvent} log (architecture §4; domain-model).
 *
 * <p>Owns its entities, services, and API. Cross-module calls come in through this
 * module's service interfaces only — never reach into another module's internals.
 *
 * <p>Skeleton (F2): package marker only. Lands in R2 (R2-9). Progress is derived
 * from the {@code ActivityEvent} log — never add bespoke progress columns.
 */
package com.beecompete.journey;
