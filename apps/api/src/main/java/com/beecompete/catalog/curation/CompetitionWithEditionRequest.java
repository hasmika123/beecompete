package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.CostType;
import com.beecompete.catalog.domain.ListingStatus;
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
 * fact the public card/detail shows (organizer, copy, links, cost type, prize, region), so a
 * manually-created listing is complete-by-default. They live HERE, not on the shared {@link
 * CompetitionRequest}/{@link EditionRequest}, so the import queue and correction-approve paths stay
 * lenient (imports start unattributed, etc.). The fee AMOUNT is deliberately not among them since
 * 2026-09-01 — see the cost-aware block below.
 */
public record CompetitionWithEditionRequest(@NotNull @Valid CompetitionRequest competition,
		@NotNull @Valid EditionRequest edition, List<@Valid FirstEditionKeyDate> keyDates,
		List<UUID> regionIds,
		/**
		 * Where the new listing starts in the §8a lifecycle. Null → PUBLISHED (the one-step
		 * create import approve and scripts rely on — approve IS the review there). The admin
		 * form sends DRAFT or IN_REVIEW explicitly; UNLISTED is not a starting state.
		 */
		ListingStatus listingStatus) {

	@AssertTrue(message = "a listing cannot start UNLISTED — publish then unlist")
	public boolean isStartingStatusLegal() {
		return listingStatus != ListingStatus.UNLISTED;
	}

	@AssertTrue(message = "an organizer is required")
	public boolean isOrganizerPresent() {
		return competition == null || competition.organizerOrgId() != null;
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
	// edition.
	//
	// ANSWERING THE COST TYPE IS THE WHOLE REQUIREMENT (owner 2026-09-01). A PAID listing no longer
	// has to state an amount: plenty of competition pages say there is a fee without publishing the
	// number (or it varies by region), and demanding one made those listings unpublishable. The
	// admin form dropped fee/currency from its required-ring on the same decision — these two
	// @AssertTrue rules were what still refused the submit, which is the bug that surfaced it.
	//
	// Nothing is lost by removing them: a STATED fee still needs a currency (EditionRequest's own
	// isEntryFeeCurrencyValid, which applies on every path, not just this one) and still cannot be
	// negative (@PositiveOrZero). The one rule that has to live HERE is the cross-level one below —
	// it is the only check that can see the competition's costType and the edition's fee together.
	private boolean isPaid() {
		return competition != null && competition.costType() == CostType.PAID;
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
