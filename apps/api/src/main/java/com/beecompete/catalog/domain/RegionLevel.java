package com.beecompete.catalog.domain;

/**
 * Level of a structured geo node (Country → State → County → City), plus two rows that are not
 * places: the "Virtual/Online" region (domain-model Q3) so virtual Editions can be tagged, and
 * INTERNATIONAL.
 *
 * <p>INTERNATIONAL was added 2026-09-03 as the region-side partner of {@link ScopeLevel#INTERNATIONAL}
 * (added 2026-08-20 for ISEF / FIRST Robotics). The registry seeds US geography only, so a running
 * that reaches many countries had no honest tag: NOT tagging it left the required region empty, and
 * tagging "United States" published it as US-only in the marketplace filter. This is the one row
 * that says "many countries" without naming them — it is NOT a substitute for a real country row
 * once one exists, and a running with a physical venue should still carry that venue too.
 *
 * <p>Persisted as a string in a VARCHAR(20) column with no CHECK constraint, so widening the enum
 * needs no migration — only the seed row (Liquibase {@code 0025}).
 */
public enum RegionLevel {
	INTERNATIONAL,
	COUNTRY,
	STATE,
	COUNTY,
	CITY,
	VIRTUAL
}
