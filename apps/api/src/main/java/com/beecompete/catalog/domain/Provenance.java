package com.beecompete.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Reusable embedded provenance (domain-model §3f): where a curated record came from, when it was
 * last verified, and a confidence score. Typed columns (D1: we filter/report on these) rather than
 * a JSONB blob. Paired with a separate {@code verification_state} column on the owning entity.
 */
@Embeddable
public class Provenance {

	@Enumerated(EnumType.STRING)
	@Column(name = "provenance_source", length = 20)
	private ProvenanceSource source;

	@Column(name = "provenance_last_verified_at")
	private Instant lastVerifiedAt;

	@Column(name = "provenance_confidence", precision = 3, scale = 2)
	private BigDecimal confidence;

	protected Provenance() {}

	public Provenance(ProvenanceSource source, Instant lastVerifiedAt, BigDecimal confidence) {
		this.source = source;
		this.lastVerifiedAt = lastVerifiedAt;
		this.confidence = confidence;
	}

	public ProvenanceSource getSource() {
		return source;
	}

	public void setSource(ProvenanceSource source) {
		this.source = source;
	}

	public Instant getLastVerifiedAt() {
		return lastVerifiedAt;
	}

	public void setLastVerifiedAt(Instant lastVerifiedAt) {
		this.lastVerifiedAt = lastVerifiedAt;
	}

	public BigDecimal getConfidence() {
		return confidence;
	}

	public void setConfidence(BigDecimal confidence) {
		this.confidence = confidence;
	}
}
