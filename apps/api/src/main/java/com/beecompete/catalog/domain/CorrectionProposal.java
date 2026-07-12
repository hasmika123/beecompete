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
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A user-submitted correction awaiting curator review (DQ6, D7). Curators approve — applying the
 * {@code payload} field-level diff to the target record and logging an ActivityEvent — or reject.
 * The main tables are never versioned; this queue is the correction mechanism.
 *
 * <p>{@code subjectId} is a polymorphic reference (kind given by {@code subjectType}); no FK.
 * {@code submittedByUserId}/{@code reviewedBy} → User (R2-1) — nullable UUIDs, no FK yet.
 */
@Entity
@Table(name = "correction_proposal")
public class CorrectionProposal {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(name = "subject_type", nullable = false, length = 20)
	private CorrectionSubjectType subjectType;

	@NotNull
	@Column(name = "subject_id", nullable = false)
	private UUID subjectId;

	@Column(name = "submitted_by_user_id")
	private UUID submittedByUserId;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(nullable = false)
	private Map<String, Object> payload;

	@Column(columnDefinition = "text")
	private String note;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private CorrectionStatus status = CorrectionStatus.PENDING;

	@Column(name = "reviewed_by")
	private UUID reviewedBy;

	@Column(name = "reviewed_at")
	private Instant reviewedAt;

	/** Set by Hibernate at insert; DB now() default remains for raw seed SQL. */
	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected CorrectionProposal() {}

	public CorrectionProposal(CorrectionSubjectType subjectType, UUID subjectId, Map<String, Object> payload) {
		this.subjectType = subjectType;
		this.subjectId = subjectId;
		this.payload = payload;
	}

	public UUID getId() {
		return id;
	}

	public CorrectionSubjectType getSubjectType() {
		return subjectType;
	}

	public void setSubjectType(CorrectionSubjectType subjectType) {
		this.subjectType = subjectType;
	}

	public UUID getSubjectId() {
		return subjectId;
	}

	public void setSubjectId(UUID subjectId) {
		this.subjectId = subjectId;
	}

	public UUID getSubmittedByUserId() {
		return submittedByUserId;
	}

	public void setSubmittedByUserId(UUID submittedByUserId) {
		this.submittedByUserId = submittedByUserId;
	}

	public Map<String, Object> getPayload() {
		return payload;
	}

	public void setPayload(Map<String, Object> payload) {
		this.payload = payload;
	}

	public String getNote() {
		return note;
	}

	public void setNote(String note) {
		this.note = note;
	}

	public CorrectionStatus getStatus() {
		return status;
	}

	public void setStatus(CorrectionStatus status) {
		this.status = status;
	}

	public UUID getReviewedBy() {
		return reviewedBy;
	}

	public void setReviewedBy(UUID reviewedBy) {
		this.reviewedBy = reviewedBy;
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
