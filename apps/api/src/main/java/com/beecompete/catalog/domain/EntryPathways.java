package com.beecompete.catalog.domain;

import java.util.Set;

/**
 * Canonical entry-pathway tokens (glossary: Entry Pathway) — HOW you enter, as distinct from
 * Eligibility (who may enter).
 *
 * <p>A plain token set rather than a Java/DB enum, mirroring {@link EvaluationTypes}, because
 * {@code competition.entry_pathways} is a multi-valued {@code text[]} facet since {@code 0024}
 * (domain-model §7a.1). Validated at the curation write boundary; adding a token is additive.
 *
 * <p><b>Three tokens, and the composites are gone.</b> The old single-value column could only say
 * "accepts more than one route" by inventing {@code SCHOOL_OR_CHAPTER} and a wildcard
 * ({@code EITHER}, renamed {@code OPEN} by {@code 0016}) — an enum standing in for a set. As a set
 * the composites are expressible directly: {@code SCHOOL_OR_CHAPTER} is {@code {SCHOOL, CHAPTER}}
 * and "open to all" is all three. {@code 0024}'s backfill expanded every stored row accordingly, so
 * no reader needs to understand the retired tokens.
 *
 * <p>Stored UPPERCASE, unlike {@code EvaluationTypes}: these were an enum in a VARCHAR column and
 * the backfill preserved that casing rather than rewriting every row for cosmetics.
 */
public final class EntryPathways {

	/** Enter on your own account. */
	public static final String INDIVIDUAL = "INDIVIDUAL";
	/** Only through a participating school. */
	public static final String SCHOOL = "SCHOOL";
	/** Only through a participating chapter/club. */
	public static final String CHAPTER = "CHAPTER";

	public static final Set<String> TOKENS = Set.of(INDIVIDUAL, SCHOOL, CHAPTER);

	private EntryPathways() {}
}
