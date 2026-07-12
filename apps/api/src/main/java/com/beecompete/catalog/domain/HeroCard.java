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
 * An admin-managed Landing hero image card (M36, domain-model §3e-bis). Exactly one active row per
 * {@link HeroCardPosition} (enforced by a unique constraint). The main card may carry a link and a
 * hover-scrim description. {@code updatedBy} → User (R2-1) — nullable UUID, no FK yet.
 */
@Entity
@Table(name = "hero_card")
public class HeroCard {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private HeroCardPosition position;

	@NotBlank
	@Column(name = "image_key", nullable = false, length = 500)
	private String imageKey;

	@NotBlank
	@Column(name = "alt_text", nullable = false, length = 300)
	private String altText;

	@Column(name = "link_url", length = 1000)
	private String linkUrl;

	@Column(length = 500)
	private String description;

	@Column(name = "updated_by")
	private UUID updatedBy;

	/** Maintained by Hibernate on every write (admin edits — R1-3), not just the DB insert default. */
	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(nullable = false)
	private int version;

	protected HeroCard() {}

	public HeroCard(HeroCardPosition position, String imageKey, String altText) {
		this.position = position;
		this.imageKey = imageKey;
		this.altText = altText;
	}

	public UUID getId() {
		return id;
	}

	public HeroCardPosition getPosition() {
		return position;
	}

	public void setPosition(HeroCardPosition position) {
		this.position = position;
	}

	public String getImageKey() {
		return imageKey;
	}

	public void setImageKey(String imageKey) {
		this.imageKey = imageKey;
	}

	public String getAltText() {
		return altText;
	}

	public void setAltText(String altText) {
		this.altText = altText;
	}

	public String getLinkUrl() {
		return linkUrl;
	}

	public void setLinkUrl(String linkUrl) {
		this.linkUrl = linkUrl;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
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
