package com.beecompete.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

/**
 * A typed timeline event on an Edition (glossary: none — implements D3, timeline as data). Any
 * timeline shape is just a set of these rows; no fixed date columns on Edition.
 */
@Entity
@Table(name = "key_date")
public class KeyDate {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "edition_id", nullable = false)
	private Edition edition;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private KeyDateType type;

	@Column(length = 200)
	private String label;

	// Nullable = "TBD" (R1-18): the milestone exists but its date isn't known yet.
	@Column(name = "starts_at")
	private Instant startsAt;

	@Column(name = "ends_at")
	private Instant endsAt;

	/** IANA zone id the human-facing date is anchored to (e.g. America/New_York). */
	@Column(length = 60)
	private String timezone;

	protected KeyDate() {}

	public KeyDate(Edition edition, KeyDateType type, Instant startsAt) {
		this.edition = edition;
		this.type = type;
		this.startsAt = startsAt;
	}

	public UUID getId() {
		return id;
	}

	public Edition getEdition() {
		return edition;
	}

	public void setEdition(Edition edition) {
		this.edition = edition;
	}

	public KeyDateType getType() {
		return type;
	}

	public void setType(KeyDateType type) {
		this.type = type;
	}

	public String getLabel() {
		return label;
	}

	public void setLabel(String label) {
		this.label = label;
	}

	public Instant getStartsAt() {
		return startsAt;
	}

	public void setStartsAt(Instant startsAt) {
		this.startsAt = startsAt;
	}

	public Instant getEndsAt() {
		return endsAt;
	}

	public void setEndsAt(Instant endsAt) {
		this.endsAt = endsAt;
	}

	public String getTimezone() {
		return timezone;
	}

	public void setTimezone(String timezone) {
		this.timezone = timezone;
	}
}
