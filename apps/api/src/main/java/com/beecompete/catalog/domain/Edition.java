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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One running of a Competition (glossary: Edition; domain-model §3a). Owns dates, registration,
 * fees, prize, and scope. Multi-level advancement is modeled by {@code advancesTo} — a self-link
 * up the chain (school → regional → state → national, Q5). Soft-deleted via {@code archivedAt}.
 */
@Entity
@Table(name = "edition")
public class Edition {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "competition_id", nullable = false)
	private Competition competition;

	@NotBlank
	@Column(name = "cycle_label", nullable = false, length = 60)
	private String cycleLabel;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private EditionStatus status;

	@Column(name = "registration_url", length = 1000)
	private String registrationUrl;

	@Column(name = "entry_fee", precision = 10, scale = 2)
	private BigDecimal entryFee;

	@Column(length = 3)
	private String currency;

	/** Age eligibility is computed "as of" this date, the way competitions state age rules. */
	@Column(name = "age_cutoff_date")
	private LocalDate ageCutoffDate;

	@Column(name = "prize_summary", length = 500)
	private String prizeSummary;

	@Column(name = "prize_value", precision = 12, scale = 2)
	private BigDecimal prizeValue;

	@Column(name = "prize_currency", length = 3)
	private String prizeCurrency;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(name = "scope_level", nullable = false, length = 20)
	private ScopeLevel scopeLevel;

	/** Advancement across Editions (Q5). Self-reference up the chain. */
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "advances_to_edition_id")
	private Edition advancesTo;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "attributes")
	private Map<String, Object> attributes;

	@Embedded
	private Provenance provenance;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(name = "verification_state", nullable = false, length = 20)
	private VerificationState verificationState = VerificationState.UNVERIFIED;

	@Column(name = "archived_at")
	private Instant archivedAt;

	/** Set by Hibernate at insert; DB now() default remains for raw seed SQL. */
	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected Edition() {}

	public Edition(Competition competition, String cycleLabel, EditionStatus status, ScopeLevel scopeLevel) {
		this.competition = competition;
		this.cycleLabel = cycleLabel;
		this.status = status;
		this.scopeLevel = scopeLevel;
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

	public String getCycleLabel() {
		return cycleLabel;
	}

	public void setCycleLabel(String cycleLabel) {
		this.cycleLabel = cycleLabel;
	}

	public EditionStatus getStatus() {
		return status;
	}

	public void setStatus(EditionStatus status) {
		this.status = status;
	}

	public String getRegistrationUrl() {
		return registrationUrl;
	}

	public void setRegistrationUrl(String registrationUrl) {
		this.registrationUrl = registrationUrl;
	}

	public BigDecimal getEntryFee() {
		return entryFee;
	}

	public void setEntryFee(BigDecimal entryFee) {
		this.entryFee = entryFee;
	}

	public String getCurrency() {
		return currency;
	}

	public void setCurrency(String currency) {
		this.currency = currency;
	}

	public LocalDate getAgeCutoffDate() {
		return ageCutoffDate;
	}

	public void setAgeCutoffDate(LocalDate ageCutoffDate) {
		this.ageCutoffDate = ageCutoffDate;
	}

	public String getPrizeSummary() {
		return prizeSummary;
	}

	public void setPrizeSummary(String prizeSummary) {
		this.prizeSummary = prizeSummary;
	}

	public BigDecimal getPrizeValue() {
		return prizeValue;
	}

	public void setPrizeValue(BigDecimal prizeValue) {
		this.prizeValue = prizeValue;
	}

	public String getPrizeCurrency() {
		return prizeCurrency;
	}

	public void setPrizeCurrency(String prizeCurrency) {
		this.prizeCurrency = prizeCurrency;
	}

	public ScopeLevel getScopeLevel() {
		return scopeLevel;
	}

	public void setScopeLevel(ScopeLevel scopeLevel) {
		this.scopeLevel = scopeLevel;
	}

	public Edition getAdvancesTo() {
		return advancesTo;
	}

	public void setAdvancesTo(Edition advancesTo) {
		this.advancesTo = advancesTo;
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
}
