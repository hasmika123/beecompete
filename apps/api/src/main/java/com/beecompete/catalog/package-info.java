/**
 * {@code catalog} module — competition, edition, category, region, resource
 * (architecture §4; domain-model §7).
 *
 * <p>Owns its entities, services, and API. Cross-module calls come in through this
 * module's service interfaces only — never reach into another module's internals.
 *
 * <p>Skeleton (F2): package marker only. Core schema + catalog API land in R1
 * (R1-1, R1-4) on Postgres/JSONB (typed Spine columns + validated JSONB attributes).
 */
package com.beecompete.catalog;
