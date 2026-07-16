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
 * An admin-managed Landing value-prop promo card (M36) — one of the two image/link cards in the
 * "Competing changes what's possible" section. Exactly one active row per {@link LandingSlot}
 * (unique constraint). {@code imageKey} is optional: when null the public page renders a
 * code-defined gradient+icon fallback (the approved blueprint look); when set (a public image URL,
 * via the R1-19 cover-presign upload) it becomes the card background. {@code updatedBy} → User
 * (R2-1) — nullable UUID, no FK yet.
 */
@Entity
@Table(name = "value_prop_card")
public class ValuePropCard {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private LandingSlot position;

	@Column(name = "image_key", length = 500)
	private String imageKey;

	@NotBlank
	@Column(name = "link_url", nullable = false, length = 1000)
	private String linkUrl;

	@NotBlank
	@Column(nullable = false, length = 200)
	private String label;

	@Column(name = "updated_by")
	private UUID updatedBy;

	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(nullable = false)
	private int version;

	protected ValuePropCard() {}

	public ValuePropCard(LandingSlot position, String linkUrl, String label) {
		this.position = position;
		this.linkUrl = linkUrl;
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

	public String getImageKey() {
		return imageKey;
	}

	public void setImageKey(String imageKey) {
		this.imageKey = imageKey;
	}

	public String getLinkUrl() {
		return linkUrl;
	}

	public void setLinkUrl(String linkUrl) {
		this.linkUrl = linkUrl;
	}

	public String getLabel() {
		return label;
	}

	public void setLabel(String label) {
		this.label = label;
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
