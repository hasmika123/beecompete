package com.beecompete.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A pipeline-extracted record awaiting curator review (R1-3 import queue; approved design
 * 2026-07-12). The S3 extraction pipeline POSTs these; approving one CREATES the real
 * Competition rows with {@code provenance.source = import} + the pipeline's confidence —
 * unreviewed imports never touch the public catalog tables. {@code reviewedBy} → User (R2-1),
 * nullable UUID with no FK yet.
 */
@Entity
@Table(name = "import_record")
public class ImportRecord {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	/** The extracted record (CompetitionRequest shape — validated on approve, not ingress). */
	@NotNull
	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false)
	private Map<String, Object> payload;

	@Column(name = "source_url", length = 1000)
	private String sourceUrl;

	@Column(precision = 3, scale = 2)
	private BigDecimal confidence;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private ImportStatus status = ImportStatus.PENDING;

	/** Pipeline extraction vs public user request (R1-15b) — surfaced to curators at review time. */
	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private ImportOrigin origin = ImportOrigin.PIPELINE;

	@Column(columnDefinition = "text")
	private String note;

	@Column(name = "reviewed_by")
	private UUID reviewedBy;

	@Column(name = "reviewed_at")
	private Instant reviewedAt;

	/** Set by Hibernate at insert; DB now() default remains for raw seed SQL. */
	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected ImportRecord() {}

	/** Pipeline/admin ingress — origin defaults to {@link ImportOrigin#PIPELINE}. */
	public ImportRecord(Map<String, Object> payload, String sourceUrl, BigDecimal confidence) {
		this(payload, sourceUrl, confidence, ImportOrigin.PIPELINE);
	}

	public ImportRecord(Map<String, Object> payload, String sourceUrl, BigDecimal confidence, ImportOrigin origin) {
		this.payload = payload;
		this.sourceUrl = sourceUrl;
		this.confidence = confidence;
		this.origin = origin;
	}

	public UUID getId() {
		return id;
	}

	public Map<String, Object> getPayload() {
		return payload;
	}

	public void setPayload(Map<String, Object> payload) {
		this.payload = payload;
	}

	public String getSourceUrl() {
		return sourceUrl;
	}

	public BigDecimal getConfidence() {
		return confidence;
	}

	public ImportStatus getStatus() {
		return status;
	}

	public ImportOrigin getOrigin() {
		return origin;
	}

	public void setStatus(ImportStatus status) {
		this.status = status;
	}

	public String getNote() {
		return note;
	}

	public void setNote(String note) {
		this.note = note;
	}

	public Instant getReviewedAt() {
		return reviewedAt;
	}

	public void setReviewedAt(Instant reviewedAt) {
		this.reviewedAt = reviewedAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
