package com.beecompete.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.beecompete.catalog.domain.EditionStatus;
import com.beecompete.catalog.domain.KeyDate;
import com.beecompete.catalog.domain.KeyDateType;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The R1-4 effective-status rule (domain-model §8), branch by branch. */
class EffectiveStatusTest {

	private static final Instant NOW = Instant.parse("2026-07-12T12:00:00Z");

	private KeyDate date(KeyDateType type, Instant startsAt) {
		return new KeyDate(null, type, startsAt);
	}

	@Test
	void curatedTerminalStatusesStand() {
		// A curator's CLOSED/ONGOING/ARCHIVED is authoritative even with future dates present.
		List<KeyDate> futureClose = List.of(date(KeyDateType.REG_CLOSE, NOW.plus(10, ChronoUnit.DAYS)));
		assertEquals(EditionStatus.CLOSED, EffectiveStatus.compute(EditionStatus.CLOSED, futureClose, NOW));
		assertEquals(EditionStatus.ONGOING, EffectiveStatus.compute(EditionStatus.ONGOING, futureClose, NOW));
		assertEquals(EditionStatus.ARCHIVED, EffectiveStatus.compute(EditionStatus.ARCHIVED, futureClose, NOW));
	}

	@Test
	void openWithPassedDeadlineRendersClosed() {
		List<KeyDate> passed = List.of(date(KeyDateType.REG_CLOSE, NOW.minus(1, ChronoUnit.DAYS)));
		assertEquals(EditionStatus.CLOSED, EffectiveStatus.compute(EditionStatus.OPEN, passed, NOW));
		assertEquals(EditionStatus.CLOSED, EffectiveStatus.compute(EditionStatus.UPCOMING, passed, NOW));
	}

	@Test
	void submissionDueIsTheFallbackDeadline() {
		List<KeyDate> submissionPassed = List.of(date(KeyDateType.SUBMISSION_DUE, NOW.minus(1, ChronoUnit.HOURS)));
		assertEquals(EditionStatus.CLOSED, EffectiveStatus.compute(EditionStatus.OPEN, submissionPassed, NOW));

		// …but REG_CLOSE wins when both exist: a future REG_CLOSE keeps it open even if a
		// submission milestone already passed (multi-round shapes).
		List<KeyDate> both = List.of(date(KeyDateType.SUBMISSION_DUE, NOW.minus(1, ChronoUnit.HOURS)),
				date(KeyDateType.REG_CLOSE, NOW.plus(5, ChronoUnit.DAYS)));
		assertEquals(EditionStatus.OPEN, EffectiveStatus.compute(EditionStatus.OPEN, both, NOW));
	}

	@Test
	void upcomingInsideTheRegistrationWindowRendersOpen() {
		List<KeyDate> window = List.of(date(KeyDateType.REG_OPEN, NOW.minus(1, ChronoUnit.DAYS)),
				date(KeyDateType.REG_CLOSE, NOW.plus(30, ChronoUnit.DAYS)));
		assertEquals(EditionStatus.OPEN, EffectiveStatus.compute(EditionStatus.UPCOMING, window, NOW));

		// REG_OPEN still ahead → stays upcoming.
		List<KeyDate> ahead = List.of(date(KeyDateType.REG_OPEN, NOW.plus(1, ChronoUnit.DAYS)));
		assertEquals(EditionStatus.UPCOMING, EffectiveStatus.compute(EditionStatus.UPCOMING, ahead, NOW));
	}

	@Test
	void noDatesMeansTheCuratedStatusStands() {
		assertEquals(EditionStatus.OPEN, EffectiveStatus.compute(EditionStatus.OPEN, List.of(), NOW));
		assertEquals(EditionStatus.UPCOMING, EffectiveStatus.compute(EditionStatus.UPCOMING, List.of(), NOW));
	}

	@Test
	void tbdDeadlineIsIgnoredAndDoesNotThrow() {
		// R1-18: a TBD key date has a null starts_at. compute() must FILTER it (the pre-R1-18 code
		// NPE'd on the min()), so an OPEN edition with only a date-less REG_CLOSE stays OPEN.
		List<KeyDate> tbdClose = List.of(date(KeyDateType.REG_CLOSE, null));
		assertEquals(EditionStatus.OPEN, EffectiveStatus.compute(EditionStatus.OPEN, tbdClose, NOW));

		// A real passed deadline still closes even when a TBD milestone is also present.
		List<KeyDate> mixed = List.of(date(KeyDateType.REG_CLOSE, null),
				date(KeyDateType.SUBMISSION_DUE, NOW.minus(1, ChronoUnit.HOURS)));
		assertEquals(EditionStatus.CLOSED, EffectiveStatus.compute(EditionStatus.OPEN, mixed, NOW));
	}
}
