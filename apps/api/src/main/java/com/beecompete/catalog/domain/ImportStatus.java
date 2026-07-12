package com.beecompete.catalog.domain;

/** Review state of an {@link ImportRecord} in the curation queue (R1-3). */
public enum ImportStatus {
	PENDING,
	APPROVED,
	REJECTED
}
