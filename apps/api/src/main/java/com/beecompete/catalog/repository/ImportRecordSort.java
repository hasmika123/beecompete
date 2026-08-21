package com.beecompete.catalog.repository;

/**
 * The sort orders the import queue offers, as SQL fragments.
 *
 * <p>An enum rather than a free-text {@code sort} parameter on purpose: the queue sorts on JSONB
 * expressions ({@code payload->>'name'}) that no JPA property path can express, so the ORDER BY has
 * to be concatenated into native SQL. Restricting it to these constants is what keeps that
 * concatenation free of caller-supplied text.
 */
public enum ImportRecordSort {

	/** Queue order — oldest first is the default review order (matches the original endpoint). */
	CREATED_AT("r.created_at"),

	/** Pipeline self-scored extraction quality. NULL for user requests, which sort last either way. */
	CONFIDENCE("r.confidence"),

	/** The extracted competition name, case-insensitively — for finding a known row, not triage. */
	NAME("lower(r.payload->>'name')"),

	/** Groups rows by the site they came from, so one bad source can be reviewed (or rejected) together. */
	SOURCE_URL("r.source_url");

	private final String expression;

	ImportRecordSort(String expression) {
		this.expression = expression;
	}

	/** The ORDER BY expression. Never contains caller-supplied text — see the class note. */
	String expression() {
		return expression;
	}
}
