package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.CostType;
import com.beecompete.catalog.domain.Delivery;
import com.beecompete.catalog.domain.EntryPathway;
import com.beecompete.catalog.domain.ParticipationMode;
import com.beecompete.catalog.domain.Recurrence;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
		// Resolve-or-create by name (import path): when no organizerOrgId is given, the service
		// reuses an org on an exact (normalized) name match, else creates one (CURATED/HOST). The
		// seeding pipeline sends this so 200+ competitions never need pre-created orgs.
		@Size(max = 300) String organizerName,
		// Curator override for the near-match guard: when a similar org name exists but no exact
		// match, resolve-or-create refuses (422) unless this is true (create a new org anyway).
		Boolean confirmNewOrganizer,
		@Size(max = 1000) String officialUrl,
		@Size(max = 1000) String logo,
		@Size(max = 10000) String description,
		@Size(max = 300) String summary,
		@NotNull UUID categoryId,
		List<String> tags,
		@NotNull ParticipationMode participationMode,
		@Min(1) Short teamSizeMin,
		@Min(1) Short teamSizeMax,
		@NotNull Delivery delivery,
		@NotNull EntryPathway entryPathway,
		List<String> evaluationType,
		@Min(-1) @Max(12) Short minGrade,
		@Min(-1) @Max(12) Short maxGrade,
		@Min(0) @Max(99) Short minAge,
		@Min(0) @Max(99) Short maxAge,
		@NotNull CostType costType,
		@NotNull Recurrence recurrence,
		Map<String, Object> attributes) {

	@AssertTrue(message = "organizer is required: pass organizerOrgId or organizerName")
	public boolean isOrganizerPresent() {
		return organizerOrgId != null || (organizerName != null && !organizerName.isBlank());
	}

	@AssertTrue(message = "minGrade must be less than or equal to maxGrade")
	public boolean isGradeRangeValid() {
		return minGrade == null || maxGrade == null || minGrade <= maxGrade;
	}

	@AssertTrue(message = "minAge must be less than or equal to maxAge")
	public boolean isAgeRangeValid() {
		return minAge == null || maxAge == null || minAge <= maxAge;
	}

	@AssertTrue(message = "teamSizeMin must be less than or equal to teamSizeMax")
	public boolean isTeamSizeRangeValid() {
		return teamSizeMin == null || teamSizeMax == null || teamSizeMin <= teamSizeMax;
	}
}
