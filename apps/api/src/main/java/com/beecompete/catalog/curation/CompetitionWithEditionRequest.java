package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.CostType;
import com.beecompete.catalog.domain.KeyDateType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Combined create payload (sweep Now-Opus): a competition shell + its FIRST edition (the year's
 * running, per glossary) + the edition's typed key dates + the edition's regions. Created in ONE
 * transaction so an admin never leaves a "zombie" listing (competition with no edition) — the
 * source-side fix that pairs with the readiness gate (domain-model §8a). Future editions use the
 * normal per-edition create. See {@link ListingCurationService}.
 *
 * <p><b>Admin-form completeness policy.</b> The {@code @AssertTrue} checks below front-load every
 * fact the public card/detail shows (organizer, copy, links, fee, prize, region), so a
 * manually-created listing is complete-by-default. They live HERE, not on the shared {@link
 * CompetitionRequest}/{@link EditionRequest}, so the import queue and correction-approve paths stay
 * lenient (imports start unattributed, etc.).
 */
public record CompetitionWithEditionRequest(@NotNull @Valid CompetitionRequest competition,
		@NotNull @Valid EditionRequest edition, List<@Valid FirstEditionKeyDate> keyDates,
		List<UUID> regionIds) {

	@AssertTrue(message = "an organizer is required")
	public boolean isOrganizerPresent() {
		return competition == null || competition.organizerOrgId() != null;
	}

	@AssertTrue(message = "a card summary is required")
	public boolean isSummaryPresent() {
		return competition == null || hasText(competition.summary());
	}

	@AssertTrue(message = "a description is required")
	public boolean isDescriptionPresent() {
		return competition == null || hasText(competition.description());
	}

	@AssertTrue(message = "an official URL is required")
	public boolean isOfficialUrlPresent() {
		return competition == null || hasText(competition.officialUrl());
	}

	@AssertTrue(message = "a registration URL is required")
	public boolean isRegistrationUrlPresent() {
		return edition == null || hasText(edition.registrationUrl());
	}

	// Cost-aware fee rules (item 17). costType is a competition-spine field; the fee lives on the
	// edition. A PAID competition must state a positive fee + currency; a FREE one must not charge.
	private boolean isPaid() {
		return competition != null && competition.costType() == CostType.PAID;
	}

	@AssertTrue(message = "a paid competition needs an entry fee greater than 0")
	public boolean isPaidEntryFeeValid() {
		return edition == null || !isPaid() || (edition.entryFee() != null && edition.entryFee().signum() > 0);
	}

	@AssertTrue(message = "a paid competition needs a currency")
	public boolean isPaidCurrencyValid() {
		return edition == null || !isPaid() || hasText(edition.currency());
	}

	@AssertTrue(message = "a free competition can’t charge an entry fee")
	public boolean isFreeFeeValid() {
		return edition == null || isPaid() || edition.entryFee() == null || edition.entryFee().signum() == 0;
	}

	@AssertTrue(message = "a prize is required")
	public boolean isPrizePresent() {
		return edition == null || hasText(edition.prizeSummary());
	}

	@AssertTrue(message = "at least one region is required")
	public boolean isRegionPresent() {
		return regionIds != null && !regionIds.isEmpty();
	}

	// Deadline completeness (item 21): a listing's card/search deadline reads REG_CLOSE with
	// SUBMISSION_DUE fallback (blueprint #31), so the first edition must carry at least one such
	// row — dated or TBD (startsAt null, R1-18). Matches the create form's required-ring rule.
	@AssertTrue(message = "a registration-close or submission-due key date is required (dated or TBD)")
	public boolean isDeadlinePresent() {
		return keyDates != null && keyDates.stream().filter(kd -> kd != null && kd.type() != null)
				.anyMatch(kd -> kd.type() == KeyDateType.REG_CLOSE || kd.type() == KeyDateType.SUBMISSION_DUE);
	}

	private static boolean hasText(String s) {
		return s != null && !s.isBlank();
	}

	/**
	 * A typed key date on the first edition (item 21) — same shape + rules as the per-edition
	 * {@code KeyDateRequest}: {@code startsAt} null = "date TBD" (R1-18, key_date.starts_at
	 * nullable); an {@code endsAt} still requires a {@code startsAt}.
	 */
	public record FirstEditionKeyDate(@NotNull KeyDateType type, @Size(max = 200) String label,
			Instant startsAt, Instant endsAt, @Size(max = 60) String timezone) {

		@AssertTrue(message = "endsAt must be after startsAt")
		public boolean isEndAfterStart() {
			return endsAt == null || (startsAt != null && endsAt.isAfter(startsAt));
		}
	}
}
