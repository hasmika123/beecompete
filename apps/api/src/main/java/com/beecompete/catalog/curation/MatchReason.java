package com.beecompete.catalog.curation;

/**
 * Why something is a duplicate candidate (glossary: Match reason; DQ4). Surfaced verbatim to the
 * admin UI and the seeding tool, so the names are API contract.
 *
 * <p>The first two are the EXACT signals — the identity keys the database computes
 * ({@code name_key}, {@code url_key}, migration {@code 0026}) agree. The rest are soft: a
 * curator is expected to look, and may say "not a duplicate".
 */
public enum MatchReason {
	/** Same normalized name (competition or organization). */
	NAME_EXACT,
	/** Same normalized official URL (competitions). */
	URL_EXACT,
	/** Same registrable domain (organizations). */
	DOMAIN_EXACT,
	/** Similar name — trigram similarity over the threshold, or one name key contains the other. */
	NAME_SIMILAR,
	/** The requested slug is already taken (competitions) — a slug is permanent, archived rows included. */
	SLUG_TAKEN
}
