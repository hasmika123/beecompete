package com.beecompete.catalog.domain;

/** Type of a typed timeline event on an Edition (D3 — timeline as data). */
public enum KeyDateType {
	REG_OPEN,
	REG_CLOSE,
	ROUND_START,
	SUBMISSION_DUE,
	RESULTS,
	/** A one-off MOMENT the named types don't cover. Label carries the specifics. */
	CUSTOM,
	/**
	 * A one-off PERIOD — the span counterpart of {@link #CUSTOM} (owner 2026-08-31). "Finals week",
	 * "judging window": something that runs across days rather than happening at one.
	 *
	 * Added without a migration: {@code key_date.type} is a VARCHAR(20) with no CHECK constraint, so
	 * the vocabulary lives in this enum and the web token list. It is the generic-window slot
	 * {@code docs/timeline-model-plan.md} §4.1 reserves, landing early because curators needed it
	 * before the full remodel.
	 */
	CUSTOM_PHASE
}
