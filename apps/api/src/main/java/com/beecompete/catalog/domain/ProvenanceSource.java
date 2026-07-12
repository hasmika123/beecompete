package com.beecompete.catalog.domain;

/** Where a record originated (domain-model §3f — embedded in {@link Provenance}). */
public enum ProvenanceSource {
	CURATED,
	IMPORT,
	HOST_SUBMITTED,
	CROWDSOURCED
}
