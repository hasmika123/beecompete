package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.domain.ProvenanceSource;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Provenance stamps for admin writes (R1-3 rule: EVERY admin write stamps provenance).
 * Manual curation = {@code curated} at full confidence; approving an import keeps
 * {@code import} + the pipeline's confidence score (domain-model §3f).
 */
public final class CurationStamps {

	private CurationStamps() {}

	/** A curator touched this by hand — curated, verified now, full confidence. */
	public static Provenance curated() {
		return new Provenance(ProvenanceSource.CURATED, Instant.now(), BigDecimal.ONE);
	}

	/** Approved from the import queue — provenance stays import, with the pipeline's confidence. */
	public static Provenance imported(BigDecimal confidence) {
		return new Provenance(ProvenanceSource.IMPORT, Instant.now(), confidence);
	}
}
