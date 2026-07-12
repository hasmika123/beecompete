package com.beecompete.catalog.service;

import com.beecompete.catalog.domain.EditionStatus;
import com.beecompete.catalog.domain.KeyDate;
import com.beecompete.catalog.domain.KeyDateType;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * The effective-status rule (domain-model §8, binding for R1-4/R1-5 read paths):
 * {@code edition.status} is curated and CAN drift from the key-date timeline, so public reads
 * must render {@code f(status, key_dates, now())}, never the raw column.
 *
 * <p>R1-4 rule set (v0): a curated CLOSED/ONGOING/ARCHIVED stands (the curator said so). An
 * UPCOMING/OPEN edition whose registration deadline (earliest REG_CLOSE, falling back to
 * earliest SUBMISSION_DUE) has passed renders CLOSED; an UPCOMING edition whose REG_OPEN has
 * passed (deadline still ahead) renders OPEN. S5's stale-date report flags the drift for
 * curator correction — this rule keeps the public read honest in the meantime.
 */
public final class EffectiveStatus {

	private EffectiveStatus() {}

	public static EditionStatus compute(EditionStatus status, List<KeyDate> keyDates, Instant now) {
		if (status != EditionStatus.UPCOMING && status != EditionStatus.OPEN) {
			return status;
		}
		Optional<Instant> deadline = earliest(keyDates, KeyDateType.REG_CLOSE)
				.or(() -> earliest(keyDates, KeyDateType.SUBMISSION_DUE));
		if (deadline.isPresent() && !deadline.get().isAfter(now)) {
			return EditionStatus.CLOSED;
		}
		if (status == EditionStatus.UPCOMING) {
			Optional<Instant> regOpen = earliest(keyDates, KeyDateType.REG_OPEN);
			if (regOpen.isPresent() && !regOpen.get().isAfter(now)) {
				return EditionStatus.OPEN;
			}
		}
		return status;
	}

	private static Optional<Instant> earliest(List<KeyDate> keyDates, KeyDateType type) {
		return keyDates.stream()
				.filter(k -> k.getType() == type)
				.map(KeyDate::getStartsAt)
				.min(Comparator.naturalOrder());
	}
}
