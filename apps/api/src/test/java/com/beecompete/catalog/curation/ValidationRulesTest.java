package com.beecompete.catalog.curation;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.beecompete.catalog.domain.CostType;
import com.beecompete.catalog.domain.Delivery;
import com.beecompete.catalog.domain.EditionStatus;
import com.beecompete.catalog.domain.EligibilityBasis;
import com.beecompete.catalog.domain.EntryPathways;
import com.beecompete.catalog.domain.ParticipationMode;
import com.beecompete.catalog.domain.Recurrence;
import com.beecompete.catalog.domain.ScopeLevel;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.math.BigDecimal;
import java.util.Set;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * A5 validation hardening — the Bean Validation rules on the two write DTOs, exercised with a
 * standalone {@link Validator} (no Spring context, no Docker). These are the server-side gate the
 * form mirrors; a failure here is what surfaces as a 400 with the rule's message.
 */
class ValidationRulesTest {

	private static final ValidatorFactory FACTORY = Validation.buildDefaultValidatorFactory();
	private static final Validator V = FACTORY.getValidator();

	private static boolean hasMessage(Set<? extends ConstraintViolation<?>> violations, String fragment) {
		return violations.stream().anyMatch(v -> v.getMessage().contains(fragment));
	}

	// --- CompetitionRequest ---

	private CompetitionRequest competition(Short minGrade, Short maxGrade, Short teamMin, Short teamMax) {
		// organizerName (not id) satisfies the mandatory-organizer rule — the resolve-or-create path.
		return new CompetitionRequest("amc-10", "AMC 10", null, "Test Org", null, null, null, null,
				UUID.randomUUID(), null, ParticipationMode.INDIVIDUAL, teamMin, teamMax, Delivery.IN_PERSON,
				List.of(EntryPathways.INDIVIDUAL), null, EligibilityBasis.GRADE, minGrade, maxGrade, null, null,
				CostType.FREE, Recurrence.ANNUAL, null);
	}

	@Test
	void validCompetitionPasses() {
		assertTrue(V.validate(competition((short) 9, (short) 12, null, null)).isEmpty());
	}

	@Test
	void organizerMissingFails() {
		// Neither organizerOrgId nor organizerName → the mandatory-organizer @AssertTrue fails.
		CompetitionRequest noOrg = new CompetitionRequest("amc-10", "AMC 10", null, null, null, null, null, null,
				UUID.randomUUID(), null, ParticipationMode.INDIVIDUAL, null, null, Delivery.IN_PERSON,
				List.of(EntryPathways.INDIVIDUAL), null, EligibilityBasis.GRADE, (short) 9, (short) 12, null, null,
				CostType.FREE, Recurrence.ANNUAL, null);
		assertTrue(hasMessage(V.validate(noOrg), "organizer is required"));
	}

	@Test
	void organizerByIdPasses() {
		// An organizerOrgId (no name) also satisfies the rule.
		CompetitionRequest byId = new CompetitionRequest("amc-10", "AMC 10", UUID.randomUUID(), null, null, null,
				null, null, UUID.randomUUID(), null, ParticipationMode.INDIVIDUAL, null, null,
				Delivery.IN_PERSON, List.of(EntryPathways.INDIVIDUAL), null, EligibilityBasis.GRADE, (short) 9, (short) 12,
				null, null, CostType.FREE, Recurrence.ANNUAL, null);
		assertTrue(V.validate(byId).isEmpty());
	}

	@Test
	void eligibilityBasisMustBeBackedByTheRangeItClaims() {
		// basis=GRADE with no grade range is the failure 0023 exists to end: a card and strip left
		// asserting an eligibility nobody recorded.
		CompetitionRequest unbacked = new CompetitionRequest("amc-10", "AMC 10", null, "Test Org", null, null,
				null, null, UUID.randomUUID(), null, ParticipationMode.INDIVIDUAL, null, null,
				Delivery.IN_PERSON, List.of(EntryPathways.INDIVIDUAL), null, EligibilityBasis.GRADE, null, null, null,
				null, CostType.FREE, Recurrence.ANNUAL, null);
		assertTrue(hasMessage(V.validate(unbacked), "eligibilityBasis must match the ranges provided"));
	}

	@Test
	void ageBasisIsBackedByAnAgeRangeAlone() {
		// The Breakthrough Junior Challenge shape: ages stated, grades absent. Must pass — this is
		// precisely the listing the old grade-only model could not represent honestly.
		CompetitionRequest ageOnly = new CompetitionRequest("bjc", "Breakthrough Junior Challenge", null,
				"Test Org", null, null, null, null, UUID.randomUUID(), null, ParticipationMode.INDIVIDUAL,
				null, null, Delivery.VIRTUAL, List.of(EntryPathways.INDIVIDUAL), null, EligibilityBasis.AGE, null, null,
				(short) 13, (short) 18, CostType.FREE, Recurrence.ANNUAL, null);
		assertTrue(V.validate(ageOnly).isEmpty());
	}

	@Test
	void openAndAbsentBasisNeedNoRange() {
		// OPEN is a stated "no restriction"; null is "nobody recorded it". Neither carries a range.
		for (EligibilityBasis basis : new EligibilityBasis[] {EligibilityBasis.OPEN, null}) {
			CompetitionRequest noRange = new CompetitionRequest("open-comp", "Open Comp", null, "Test Org",
					null, null, null, null, UUID.randomUUID(), null, ParticipationMode.INDIVIDUAL, null, null,
					Delivery.VIRTUAL, List.of(EntryPathways.INDIVIDUAL), null, basis, null, null, null, null,
					CostType.FREE, Recurrence.ANNUAL, null);
			assertTrue(V.validate(noRange).isEmpty(), "basis " + basis + " should need no range");
		}
	}

	@Test
	void gradeMinAboveMaxFails() {
		assertTrue(hasMessage(V.validate(competition((short) 10, (short) 5, null, null)),
				"minGrade must be less than or equal to maxGrade"));
	}

	@Test
	void gradeLadderTopsOutAtGraduate() {
		// @Max(17) since 2026-08-24: 13-16 are the four college years and 17 is Graduate; 18 is not
		// a rung. (13/14 meant College/Graduate between 2026-08-23 and the split.)
		assertTrue(V.validate(competition((short) 9, (short) 13, null, null)).isEmpty());
		assertTrue(V.validate(competition((short) 13, (short) 16, null, null)).isEmpty());
		assertTrue(V.validate(competition((short) 16, (short) 17, null, null)).isEmpty());
		assertFalse(V.validate(competition((short) 9, (short) 18, null, null)).isEmpty());
	}

	@Test
	void teamSizeMinAboveMaxFails() {
		assertTrue(hasMessage(V.validate(competition((short) 9, (short) 12, (short) 5, (short) 2)),
				"teamSizeMin must be less than or equal to teamSizeMax"));
	}

	@Test
	void teamSizeBelowOneFails() {
		assertFalse(V.validate(competition((short) 9, (short) 12, (short) 0, (short) 3)).isEmpty());
	}

	// --- EditionRequest ---

	private EditionRequest edition(BigDecimal fee, String currency, BigDecimal prize, String prizeCurrency) {
		return new EditionRequest("2026", EditionStatus.OPEN, null, fee, currency, null, null, prize,
				prizeCurrency, ScopeLevel.NATIONAL, null, null);
	}

	@Test
	void validEditionPasses() {
		assertTrue(V.validate(edition(new BigDecimal("10.00"), "USD", new BigDecimal("500.00"), "USD"))
				.isEmpty());
	}

	@Test
	void entryFeeWithoutCurrencyFails() {
		assertTrue(hasMessage(V.validate(edition(new BigDecimal("10.00"), null, null, null)),
				"an entry fee needs a currency"));
	}

	@Test
	void lowercaseCurrencyFails() {
		assertTrue(hasMessage(V.validate(edition(new BigDecimal("10.00"), "usd", null, null)),
				"currency must be a 3-letter ISO code"));
	}

	@Test
	void negativeEntryFeeFails() {
		assertFalse(V.validate(edition(new BigDecimal("-1.00"), "USD", null, null)).isEmpty());
	}

	@Test
	void prizeValueWithoutPrizeCurrencyFails() {
		assertTrue(hasMessage(V.validate(edition(null, null, new BigDecimal("500.00"), null)),
				"a prize value needs a prize currency"));
	}

	// --- FaqRequest ---

	@Test
	void faqAnswerAtTheLimitPasses() {
		assertTrue(V.validate(new FaqRequest("Q?", "a".repeat(FaqRequest.MAX_ANSWER), (short) 0)).isEmpty());
	}

	/**
	 * The column is TEXT, so nothing below this constraint stops an oversized answer (owner
	 * 2026-08-30). Added because the curation form now mirrors server limits field-for-field, and a
	 * cap that lived only in the browser would not survive a direct API call.
	 */
	@Test
	void faqAnswerOverTheLimitFails() {
		assertFalse(V.validate(new FaqRequest("Q?", "a".repeat(FaqRequest.MAX_ANSWER + 1), (short) 0)).isEmpty());
	}

	@Test
	void blankFaqAnswerStillFails() {
		assertFalse(V.validate(new FaqRequest("Q?", "   ", (short) 0)).isEmpty());
	}
}
