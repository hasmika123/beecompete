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
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * A curated per-competition FAQ entry (details-page FAQ tab, FAQPage structured data — R1-7,
 * page-blueprints §3a). Stored as ordered child rows (not a JSONB array on Competition) so the
 * admin tool (R1-3) can CRUD entries individually and the FAQPage markup iterates them in order.
 */
@Entity
@Table(name = "competition_faq")
public class CompetitionFaq {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "competition_id", nullable = false)
	private Competition competition;

	@NotBlank
	@Column(nullable = false, length = 500)
	private String question;

	@NotBlank
	@Column(nullable = false, columnDefinition = "text")
	private String answer;

	@Column(name = "display_order", nullable = false)
	private short displayOrder = 0;

	/** Set by Hibernate at insert; DB now() default remains for raw seed SQL. */
	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(nullable = false)
	private int version;

	protected CompetitionFaq() {}

	public CompetitionFaq(Competition competition, String question, String answer, short displayOrder) {
		this.competition = competition;
		this.question = question;
		this.answer = answer;
		this.displayOrder = displayOrder;
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

	public String getQuestion() {
		return question;
	}

	public void setQuestion(String question) {
		this.question = question;
	}

	public String getAnswer() {
		return answer;
	}

	public void setAnswer(String answer) {
		this.answer = answer;
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

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public int getVersion() {
		return version;
	}
}
