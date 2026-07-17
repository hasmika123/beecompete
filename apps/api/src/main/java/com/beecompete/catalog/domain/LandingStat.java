package com.beecompete.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * An admin-managed Landing admissions stat (M36) — one of the two stat cards in the "Competing
 * changes what's possible" section. Exactly one active row per {@link LandingSlot} (unique
 * constraint). {@code value} is the prominent figure (e.g. "72%"), {@code label} the descriptive
 * line, {@code source} the optional attribution (the §3 credibility rule wants non-causal,
 * sourced figures before launch). {@code updatedBy} → User (R2-1) — nullable UUID, no FK yet.
 */
@Entity
@Table(name = "landing_stat")
public class LandingStat {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private LandingSlot position;

	@NotBlank
	@Column(nullable = false, length = 60)
	private String value;

	@NotBlank
	@Column(nullable = false, length = 300)
	private String label;

	@Column(length = 300)
	private String source;

	@Column(name = "updated_by")
	private UUID updatedBy;

	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(nullable = false)
	private int version;

	protected LandingStat() {}

	public LandingStat(LandingSlot position, String value, String label) {
		this.position = position;
		this.value = value;
		this.label = label;
	}

	public UUID getId() {
		return id;
	}

	public LandingSlot getPosition() {
		return position;
	}

	public void setPosition(LandingSlot position) {
		this.position = position;
	}

	public String getValue() {
		return value;
	}

	public void setValue(String value) {
		this.value = value;
	}

	public String getLabel() {
		return label;
	}

	public void setLabel(String label) {
		this.label = label;
	}

	public String getSource() {
		return source;
	}

	public void setSource(String source) {
		this.source = source;
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
