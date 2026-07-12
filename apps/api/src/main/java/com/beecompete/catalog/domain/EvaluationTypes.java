package com.beecompete.catalog.domain;

import java.util.Set;

/**
 * Canonical evaluation-type tokens (glossary: Format — how work is judged). A plain token set,
 * not a Java/DB enum: {@code competition.evaluation_type} is a multi-valued {@code text[]}
 * facet (domain-model §8), and tokens are stored in their public lowercase form so reads need
 * no conversion. Validated at the curation write boundary (R1-5, closing the R1-1 note on
 * {@link Competition#getEvaluationType()}); adding a token is purely additive.
 */
public final class EvaluationTypes {

	public static final Set<String> TOKENS =
			Set.of("submission", "exam", "live_performance", "interview", "portfolio");

	private EvaluationTypes() {}
}
