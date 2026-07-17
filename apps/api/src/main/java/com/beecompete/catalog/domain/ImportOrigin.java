package com.beecompete.catalog.domain;

/**
 * Where an {@link ImportRecord} came from — a first-class discriminator so curators can tell an
 * unvetted public "Request a Competition" submission (R1-15b, DQ15) from an S3 pipeline
 * extraction at DECISION time. (Previously signalled only by a null confidence + a note string,
 * which no review surface showed and which the approve path overwrites.)
 */
public enum ImportOrigin {
	/** S3 extraction pipeline, or a manual admin submission via the admin intake. */
	PIPELINE,
	/** The public Request-a-Competition form — unvetted, review with extra skepticism. */
	USER_REQUEST
}
