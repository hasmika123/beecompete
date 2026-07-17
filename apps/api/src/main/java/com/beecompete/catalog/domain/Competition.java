package com.beecompete.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
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
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * The evergreen Competition (glossary: Competition; domain-model §3a). Owns identity, category,
 * eligibility Spine, and category-specific {@code attributes} (validated per Category Template).
 * Dates/registration/results live on {@link Edition}, never here.
 *
 * <p>Soft-deleted via {@code archivedAt} (D7) — curated slugs carry SEO, so records are archived,
 * never hard-deleted.
 */
@Entity
@Table(name = "competition")
public class Competition {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@NotBlank
	@Size(max = 160)
	@Column(nullable = false, length = 160)
	private String slug;

	@NotBlank
	@Size(max = 300)
	@Column(nullable = false, length = 300)
	private String name;

	/** The organizer (glossary: Host) — card/details attribution + DQ13 seal. Mandatory: every write
	 * path resolves-or-creates an org (migration 0012, NOT NULL). Imports send an organizerName the
	 * server resolves to an org; a row that can't be attributed is flagged for manual assignment. */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "organizer_org_id", nullable = false)
	private Organization organizer;

	@Column(name = "official_url", length = 1000)
	private String officialUrl;

	@Column(length = 1000)
	private String logo;

	@Column(columnDefinition = "text")
	private String description;

	/** Curated 1–2 sentence blurb for the CompetitionCard (clamp-2). Falls back to truncated description. */
	@Size(max = 300)
	@Column(length = 300)
	private String summary;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "category_id", nullable = false)
	private Category category;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(name = "tags", columnDefinition = "text[]")
	private List<String> tags;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(name = "participation_mode", nullable = false, length = 20)
	private ParticipationMode participationMode;

	@Column(name = "team_size_min")
	private Short teamSizeMin;

	@Column(name = "team_size_max")
	private Short teamSizeMax;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private Delivery delivery;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(name = "entry_pathway", nullable = false, length = 20)
	private EntryPathway entryPathway;

	/** Allowed tokens validated against evaluation types at the service boundary (R1-4/R1-5). */
	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(name = "evaluation_type", columnDefinition = "text[]")
	private List<String> evaluationType;

	/** Grade encoding (Q2, locked): Pre-K −1, K 0, grades 1–12; 13 reserved. */
	@Column(name = "min_grade")
	private Short minGrade;

	@Column(name = "max_grade")
	private Short maxGrade;

	@Column(name = "min_age")
	private Short minAge;

	@Column(name = "max_age")
	private Short maxAge;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(name = "cost_type", nullable = false, length = 10)
	private CostType costType;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private Recurrence recurrence;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "attributes")
	private Map<String, Object> attributes;

	@Embedded
	private Provenance provenance;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(name = "verification_state", nullable = false, length = 20)
	// R1-19: vestigial on Competition — maintainer is derived from the organizer org, so this is
	// held at the constant CURATED and never read. Kept (not dropped) under additive-only.
	private VerificationState verificationState = VerificationState.CURATED;

	@Column(name = "archived_at")
	private Instant archivedAt;

	/** Set by Hibernate at insert (so it's non-null right after save, without a reload); the DB now() default remains as a net for raw seed SQL. */
	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	/** Sitemap lastmod (R1-10), S5 freshness, audit-lite until ActivityEvent (R2-9). */
	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	/** Optimistic lock — concurrent admin edits (R1-3) conflict instead of last-write-wins. */
	@Version
	@Column(nullable = false)
	private int version;

	protected Competition() {}

	public Competition(String slug, String name, Category category, ParticipationMode participationMode,
			Delivery delivery, EntryPathway entryPathway, CostType costType, Recurrence recurrence) {
		this.slug = slug;
		this.name = name;
		this.category = category;
		this.participationMode = participationMode;
		this.delivery = delivery;
		this.entryPathway = entryPathway;
		this.costType = costType;
		this.recurrence = recurrence;
	}

	public UUID getId() {
		return id;
	}

	public String getSlug() {
		return slug;
	}

	public void setSlug(String slug) {
		this.slug = slug;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public Organization getOrganizer() {
		return organizer;
	}

	public void setOrganizer(Organization organizer) {
		this.organizer = organizer;
	}

	public String getSummary() {
		return summary;
	}

	public void setSummary(String summary) {
		this.summary = summary;
	}

	public String getOfficialUrl() {
		return officialUrl;
	}

	public void setOfficialUrl(String officialUrl) {
		this.officialUrl = officialUrl;
	}

	public String getLogo() {
		return logo;
	}

	public void setLogo(String logo) {
		this.logo = logo;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public Category getCategory() {
		return category;
	}

	public void setCategory(Category category) {
		this.category = category;
	}

	public List<String> getTags() {
		return tags;
	}

	public void setTags(List<String> tags) {
		this.tags = tags;
	}

	public ParticipationMode getParticipationMode() {
		return participationMode;
	}

	public void setParticipationMode(ParticipationMode participationMode) {
		this.participationMode = participationMode;
	}

	public Short getTeamSizeMin() {
		return teamSizeMin;
	}

	public void setTeamSizeMin(Short teamSizeMin) {
		this.teamSizeMin = teamSizeMin;
	}

	public Short getTeamSizeMax() {
		return teamSizeMax;
	}

	public void setTeamSizeMax(Short teamSizeMax) {
		this.teamSizeMax = teamSizeMax;
	}

	public Delivery getDelivery() {
		return delivery;
	}

	public void setDelivery(Delivery delivery) {
		this.delivery = delivery;
	}

	public EntryPathway getEntryPathway() {
		return entryPathway;
	}

	public void setEntryPathway(EntryPathway entryPathway) {
		this.entryPathway = entryPathway;
	}

	public List<String> getEvaluationType() {
		return evaluationType;
	}

	public void setEvaluationType(List<String> evaluationType) {
		this.evaluationType = evaluationType;
	}

	public Short getMinGrade() {
		return minGrade;
	}

	public void setMinGrade(Short minGrade) {
		this.minGrade = minGrade;
	}

	public Short getMaxGrade() {
		return maxGrade;
	}

	public void setMaxGrade(Short maxGrade) {
		this.maxGrade = maxGrade;
	}

	public Short getMinAge() {
		return minAge;
	}

	public void setMinAge(Short minAge) {
		this.minAge = minAge;
	}

	public Short getMaxAge() {
		return maxAge;
	}

	public void setMaxAge(Short maxAge) {
		this.maxAge = maxAge;
	}

	public CostType getCostType() {
		return costType;
	}

	public void setCostType(CostType costType) {
		this.costType = costType;
	}

	public Recurrence getRecurrence() {
		return recurrence;
	}

	public void setRecurrence(Recurrence recurrence) {
		this.recurrence = recurrence;
	}

	public Map<String, Object> getAttributes() {
		return attributes;
	}

	public void setAttributes(Map<String, Object> attributes) {
		this.attributes = attributes;
	}

	public Provenance getProvenance() {
		return provenance;
	}

	public void setProvenance(Provenance provenance) {
		this.provenance = provenance;
	}

	public VerificationState getVerificationState() {
		return verificationState;
	}

	public void setVerificationState(VerificationState verificationState) {
		this.verificationState = verificationState;
	}

	public Instant getArchivedAt() {
		return archivedAt;
	}

	public void setArchivedAt(Instant archivedAt) {
		this.archivedAt = archivedAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public int getVersion() {
		return version;
	}
}
