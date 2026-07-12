package com.beecompete.catalog.domain;

/** Trust state of a curated record (domain-model §3f; drives the Curated/Verified badges — R1-9). */
public enum VerificationState {
	CURATED,
	CLAIMED,
	VERIFIED,
	UNVERIFIED
}
