/**
 * {@code discovery} module — search and recommendations (architecture §4).
 *
 * <p>Owns its entities, services, and API. Cross-module calls come in through this
 * module's service interfaces only — never reach into another module's internals.
 *
 * <p>Skeleton (F2): package marker only. Search/filter API lands in R1 (R1-5;
 * Postgres FTS + pg_trgm); personalized recommendations in R2.
 */
package com.beecompete.discovery;
