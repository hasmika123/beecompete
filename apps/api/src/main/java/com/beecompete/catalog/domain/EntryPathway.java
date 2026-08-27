package com.beecompete.catalog.domain;

/**
 * How you enter a Competition (glossary: Entry Pathway; added 2026-07-08). Distinct from
 * Eligibility (who may enter).
 *
 * <p>Widened 2026-08-23 (owner): SCHOOL and CHAPTER split apart, and EITHER renamed OPEN
 * ("open to all" — what curators actually mean). Persisted as a string in a VARCHAR(20) column
 * with no CHECK constraint, so widening needs no schema migration (same rule as ScopeLevel).
 *
 * <p>{@code SCHOOL_OR_CHAPTER} and {@code EITHER} are RETAINED, not dropped: rows written before
 * the split still carry them. EITHER is migrated to OPEN by {@code 0016}; SCHOOL_OR_CHAPTER
 * stays a legitimate answer (some competitions genuinely accept both routes) and can never be
 * auto-split — only a curator knows which one a listing means.
 */
public enum EntryPathway {
	INDIVIDUAL,
	SCHOOL,
	CHAPTER,
	SCHOOL_OR_CHAPTER,
	OPEN,
	/** @deprecated legacy alias for {@link #OPEN} — migrated by 0016, kept so old rows still read. */
	@Deprecated
	EITHER
}
