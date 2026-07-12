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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A curated prep/reference link on a Competition (glossary: Resource; → R1-8). Affiliate links are
 * flagged ({@code isAffiliate}) so the UI can render the required affiliate disclosure. 🔒
 */
@Entity
@Table(name = "resource")
public class Resource {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "competition_id", nullable = false)
	private Competition competition;

	@NotBlank
	@Column(nullable = false, length = 300)
	private String title;

	@NotBlank
	@Column(nullable = false, length = 1000)
	private String url;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private ResourceType type;

	@Column(name = "is_affiliate", nullable = false)
	private boolean affiliate = false;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "affiliate_meta")
	private Map<String, Object> affiliateMeta;

	@Column(name = "display_order", nullable = false)
	private short displayOrder = 0;

	/** Set by Hibernate at insert; DB now() default remains for raw seed SQL. */
	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected Resource() {}

	public Resource(Competition competition, String title, String url, ResourceType type) {
		this.competition = competition;
		this.title = title;
		this.url = url;
		this.type = type;
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

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public String getUrl() {
		return url;
	}

	public void setUrl(String url) {
		this.url = url;
	}

	public ResourceType getType() {
		return type;
	}

	public void setType(ResourceType type) {
		this.type = type;
	}

	public boolean isAffiliate() {
		return affiliate;
	}

	public void setAffiliate(boolean affiliate) {
		this.affiliate = affiliate;
	}

	public Map<String, Object> getAffiliateMeta() {
		return affiliateMeta;
	}

	public void setAffiliateMeta(Map<String, Object> affiliateMeta) {
		this.affiliateMeta = affiliateMeta;
	}

	public short getDisplayOrder() {
		return displayOrder;
	}

	public void setDisplayOrder(short displayOrder) {
		this.displayOrder = displayOrder;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
