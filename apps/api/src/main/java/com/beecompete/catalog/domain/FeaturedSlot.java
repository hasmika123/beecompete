package com.beecompete.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * An admin-picked Landing carousel entry (M36, domain-model §3e-bis). Ordered by {@code position}
 * (6–10 cap enforced in the admin tool — R1-3). Editorial, not paid (Promotion M28 arrives later
 * as its own labeled thing). A Competition appears at most once (unique constraint).
 * {@code updatedBy} → User (R2-1) — nullable UUID, no FK yet.
 */
@Entity
@Table(name = "featured_slot")
public class FeaturedSlot {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "competition_id", nullable = false)
	private Competition competition;

	@Column(nullable = false)
	private short position;

	@Column(name = "updated_by")
	private UUID updatedBy;

	/** Maintained by Hibernate on every write (admin edits — R1-3), not just the DB insert default. */
	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(nullable = false)
	private int version;

	protected FeaturedSlot() {}

	public FeaturedSlot(Competition competition, short position) {
		this.competition = competition;
		this.position = position;
	}

	public UUID getId() {
		return id;
	}

	public Competition getCompetition() {
		return competition;
	}

	public void setCompetition(Competition competition) {
		this.competition = competition;
	}

	public short getPosition() {
		return position;
	}

	public void setPosition(short position) {
		this.position = position;
	}

	public UUID getUpdatedBy() {
		return updatedBy;
	}

	public void setUpdatedBy(UUID updatedBy) {
		this.updatedBy = updatedBy;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public int getVersion() {
		return version;
	}
}
