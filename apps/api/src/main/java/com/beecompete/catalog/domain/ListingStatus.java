package com.beecompete.catalog.domain;

/**
 * Listing lifecycle (domain-model §8a): {@code DRAFT → IN_REVIEW → PUBLISHED ⇄ UNLISTED}.
 * Deliberately NOT the whole state: archived is {@code archived_at} (orthogonal — archiving
 * auto-unlists via the public gate), and per-running open/closed is {@link EditionStatus} +
 * EffectiveStatus. Only PUBLISHED rows pass the public read gate.
 *
 * <p>{@code IN_REVIEW} at R1 is the curator workflow ("someone should look before this goes
 * live"), surfaced on the admin review queue; the DQ12 host pre-publication review reuses this
 * value at Phase 3.
 */
public enum ListingStatus {
	DRAFT, IN_REVIEW, PUBLISHED, UNLISTED;

	/** Legal transitions (§8a). Publishing from DRAFT directly is allowed — review is optional for admins. */
	public boolean canTransitionTo(ListingStatus next) {
		return switch (this) {
			case DRAFT -> next == IN_REVIEW || next == PUBLISHED;
			case IN_REVIEW -> next == PUBLISHED || next == DRAFT; // approve, or send back
			case PUBLISHED -> next == UNLISTED;
			case UNLISTED -> next == PUBLISHED; // re-list
		};
	}
}
