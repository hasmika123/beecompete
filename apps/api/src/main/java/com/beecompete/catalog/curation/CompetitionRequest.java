package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.CostType;
import com.beecompete.catalog.domain.Delivery;
import com.beecompete.catalog.domain.EntryPathway;
import com.beecompete.catalog.domain.ParticipationMode;
import com.beecompete.catalog.domain.Recurrence;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Admin create/update payload for a Competition (R1-3). Also the shape an {@link
 * com.beecompete.catalog.domain.ImportRecord} payload must deserialize into on approve — one
 * validation path for both write sources. Bean Validation covers the Spine; the {@code attributes}
 * bag is additionally validated against the Category Template JSON Schema in the service.
 */
public record CompetitionRequest(
		@NotBlank @Size(max = 160) @Pattern(regexp = "[a-z0-9]+(-[a-z0-9]+)*",
				message = "slug must be lowercase kebab-case") String slug,
		@NotBlank @Size(max = 300) String name,
		UUID organizerOrgId,
		@Size(max = 1000) String officialUrl,
		@Size(max = 1000) String logo,
		String description,
		@Size(max = 300) String summary,
		@NotNull UUID categoryId,
		List<String> tags,
		@NotNull ParticipationMode participationMode,
		Short teamSizeMin,
		Short teamSizeMax,
		@NotNull Delivery delivery,
		@NotNull EntryPathway entryPathway,
		List<String> evaluationType,
		Short minGrade,
		Short maxGrade,
		Short minAge,
		Short maxAge,
		@NotNull CostType costType,
		@NotNull Recurrence recurrence,
		Map<String, Object> attributes) {}
