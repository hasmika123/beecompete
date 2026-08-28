package com.beecompete.catalog.domain;

/**
 * Which axis the ORGANIZER states as the entry rule (owner 2026-08-28; glossary "Eligibility
 * basis"). It governs DISPLAY: the stated axis is what the card badge and the At-a-glance strip
 * render. The other axis, when populated, is a range we derived for filtering and must never be
 * shown as a rule — a derived grade range is lossy by construction (age 18 maps to grade 12 or 13),
 * so it cannot carry a stated rule's authority.
 *
 * <p>Absent (null) is a real state and is NOT a default to {@link #GRADE}: it means nobody has
 * recorded the rule yet, and it renders "Not stated" rather than "All grades".
 *
 * <p>Refines domain-model Q2, whose locks all hold — both ranges are still stored, and grade
 * remains the primary filter axis.
 */
public enum EligibilityBasis {

	/** The organizer states grades. Any age range on the row is derived. */
	GRADE,

	/** The organizer states ages. Any grade range on the row is derived — never display it as one. */
	AGE,

	/** The organizer states both, and they are independent (e.g. "grades 7–12, and age 13+"). */
	BOTH,

	/** The organizer states there is no grade or age restriction. Distinct from null (unknown). */
	OPEN
}
