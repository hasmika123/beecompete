package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.EditionStatus;
import com.beecompete.catalog.domain.ScopeLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * Admin create/update payload for an Edition (R1-3). Promoted out of the admin controller when
 * the correction queue (R1-3b) became a second write source — same rationale as {@link
 * CompetitionRequest}: one shape, one validation path for every write.
 */
public record EditionRequest(@NotBlank @Size(max = 60) String cycleLabel, @NotNull EditionStatus status,
		@Size(max = 1000) String registrationUrl, BigDecimal entryFee, @Size(max = 3) String currency,
		LocalDate ageCutoffDate, @Size(max = 500) String prizeSummary, BigDecimal prizeValue,
		@Size(max = 3) String prizeCurrency, @NotNull ScopeLevel scopeLevel, UUID advancesToEditionId,
		Map<String, Object> attributes) {}
