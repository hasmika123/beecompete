package com.beecompete.catalog.domain;

/**
 * Geographic reach of an Edition (Q3). Pairs with the Edition's region set.
 *
 * <p>Ordered broadest → narrowest; VIRTUAL is the special online-only reach, not a place.
 * INTERNATIONAL was added 2026-08-20 after the S3 seeding sweep: ISEF and FIRST Robotics are both
 * genuinely multi-country, and with no token for it the extractor was forced to store NATIONAL —
 * wrong data, at scale, across the index. Persisted as a string in a VARCHAR(20) column with no
 * CHECK constraint, so widening the enum needs no migration.
 */
public enum ScopeLevel {
	INTERNATIONAL,
	NATIONAL,
	STATE,
	REGIONAL,
	LOCAL,
	VIRTUAL
}
