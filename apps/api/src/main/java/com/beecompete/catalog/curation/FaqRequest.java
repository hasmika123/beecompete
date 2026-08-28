package com.beecompete.catalog.curation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Admin create/update payload for a {@link com.beecompete.catalog.domain.CompetitionFaq} (R1-3).
 * Promoted out of the admin controller when import-approve became a second write source
 * (2026-08-28) — the same move {@link ResourceRequest} and {@link CompetitionRequest} made before
 * it, and for the same reason: a service cannot reach into a controller for its request shape.
 */
public record FaqRequest(@NotBlank @Size(max = 500) String question, @NotBlank String answer,
		short displayOrder) {}
