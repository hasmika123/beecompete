package com.beecompete.catalog.curation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Admin create/update payload for a {@link com.beecompete.catalog.domain.CompetitionFaq} (R1-3).
 * Promoted out of the admin controller when import-approve became a second write source
 * (2026-08-28) — the same move {@link ResourceRequest} and {@link CompetitionRequest} made before
 * it, and for the same reason: a service cannot reach into a controller for its request shape.
 */
public record FaqRequest(@NotBlank @Size(max = 500) String question,
		@NotBlank @Size(max = MAX_ANSWER) String answer, short displayOrder) {

	/**
	 * The column is TEXT, so this is an application bound, not a storage one (owner 2026-08-30).
	 * It exists because the curation form now mirrors server limits field-for-field, and a
	 * client-only cap would be a lie: anything the API accepts can still arrive through it.
	 *
	 * 2000 is ~300 words — long for an answer to one question, and well short of {@code description}
	 * (10000), which is where a genuinely long write-up belongs.
	 */
	public static final int MAX_ANSWER = 2000;
}
