package com.beecompete.catalog.curation;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.beecompete.catalog.domain.CostType;
import com.beecompete.catalog.domain.Delivery;
import com.beecompete.catalog.domain.EditionStatus;
import com.beecompete.catalog.domain.EntryPathway;
import com.beecompete.catalog.domain.ParticipationMode;
import com.beecompete.catalog.domain.Recurrence;
import com.beecompete.catalog.domain.ScopeLevel;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.math.BigDecimal;
import java.util.Set;
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
		return new CompetitionRequest("amc-10", "AMC 10", null, "Test Org", null, null, null, null, null,
				UUID.randomUUID(), null, ParticipationMode.INDIVIDUAL, teamMin, teamMax, Delivery.IN_PERSON,
				EntryPathway.INDIVIDUAL, null, minGrade, maxGrade, null, null, CostType.FREE, Recurrence.ANNUAL,
				null);
	}

	@Test
	void validCompetitionPasses() {
		assertTrue(V.validate(competition((short) 9, (short) 12, null, null)).isEmpty());
	}

	@Test
	void organizerMissingFails() {
		// Neither organizerOrgId nor organizerName → the mandatory-organizer @AssertTrue fails.
		CompetitionRequest noOrg = new CompetitionRequest("amc-10", "AMC 10", null, null, null, null, null, null,
				null, UUID.randomUUID(), null, ParticipationMode.INDIVIDUAL, null, null, Delivery.IN_PERSON,
				EntryPathway.INDIVIDUAL, null, (short) 9, (short) 12, null, null, CostType.FREE, Recurrence.ANNUAL,
				null);
		assertTrue(hasMessage(V.validate(noOrg), "organizer is required"));
	}

	@Test
	void organizerByIdPasses() {
		// An organizerOrgId (no name) also satisfies the rule.
		CompetitionRequest byId = new CompetitionRequest("amc-10", "AMC 10", UUID.randomUUID(), null, null, null,
				null, null, null, UUID.randomUUID(), null, ParticipationMode.INDIVIDUAL, null, null,
				Delivery.IN_PERSON, EntryPathway.INDIVIDUAL, null, (short) 9, (short) 12, null, null, CostType.FREE,
				Recurrence.ANNUAL, null);
		assertTrue(V.validate(byId).isEmpty());
	}

	@Test
	void gradeMinAboveMaxFails() {
		assertTrue(hasMessage(V.validate(competition((short) 10, (short) 5, null, null)),
				"minGrade must be less than or equal to maxGrade"));
	}

	@Test
	void gradeAboveTwelveFails() {
		// @Max(12): the entity's "13 reserved" comment notwithstanding, 13 is NOT accepted yet (C3).
		assertFalse(V.validate(competition((short) 9, (short) 13, null, null)).isEmpty());
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
}
