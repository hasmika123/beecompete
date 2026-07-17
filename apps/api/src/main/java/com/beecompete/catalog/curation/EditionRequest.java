package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.EditionStatus;
import com.beecompete.catalog.domain.ScopeLevel;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
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
		@Size(max = 1000) String registrationUrl,
		@PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal entryFee,
		@Pattern(regexp = "[A-Z]{3}", message = "currency must be a 3-letter ISO code") String currency,
		LocalDate ageCutoffDate, @Size(max = 500) String prizeSummary,
		@PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal prizeValue,
		@Pattern(regexp = "[A-Z]{3}", message = "prizeCurrency must be a 3-letter ISO code") String prizeCurrency,
		@NotNull ScopeLevel scopeLevel, UUID advancesToEditionId, Map<String, Object> attributes) {

	@AssertTrue(message = "an entry fee needs a currency")
	public boolean isEntryFeeCurrencyValid() {
		return entryFee == null || currency != null;
	}

	@AssertTrue(message = "a prize value needs a prize currency")
	public boolean isPrizeCurrencyValid() {
		return prizeValue == null || prizeCurrency != null;
	}
}
