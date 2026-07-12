package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.ResourceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;

/**
 * Admin create/update payload for a Resource (R1-3). Promoted out of the admin controller when
 * the correction queue (R1-3b) became a second write source — see {@link CompetitionRequest}.
 */
public record ResourceRequest(@NotBlank @Size(max = 300) String title, @NotBlank @Size(max = 1000) String url,
		@NotNull ResourceType type, boolean isAffiliate, Map<String, Object> affiliateMeta,
		short displayOrder) {}
