package com.beecompete.catalog.curation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

/**
 * The admin form asks for an organization's "Official website" rather than its domain (2026-08-28),
 * so a curator may type either a bare domain or paste a full URL. Both have to land on the same
 * stored value: host verification (DQ11) compares domains, and the resolve-or-create path has
 * always stored the registrable host.
 */
class WebDomainsTest {

	@Test
	void aBareDomainSurvivesUnchanged() {
		assertEquals("maa.org", WebDomains.registrableHost("maa.org"));
	}

	@Test
	void aPastedUrlReducesToTheSameDomain() {
		// The whole point of the rename: these three are one organization, not three.
		assertEquals("maa.org", WebDomains.registrableHost("https://maa.org"));
		assertEquals("maa.org", WebDomains.registrableHost("https://www.maa.org/math-competitions"));
		assertEquals("maa.org", WebDomains.registrableHost("http://WWW.MAA.ORG/amc-10?year=2026"));
	}

	@Test
	void surroundingWhitespaceAndCaseAreNormalized() {
		assertEquals("maa.org", WebDomains.registrableHost("  MAA.org  "));
	}

	@Test
	void aSubdomainIsKeptBecauseOnlyLeadingWwwIsNoise() {
		// events.example.org is a different host from example.org and may well be the org's real
		// home; stripping it would be a guess. Only "www." is known-redundant.
		assertEquals("events.example.org", WebDomains.registrableHost("https://events.example.org/x"));
	}

	@Test
	void unusableInputLeavesTheDomainUnset() {
		// A domain is optional metadata, not a gate — bad input must not fail the whole write.
		assertNull(WebDomains.registrableHost(null));
		assertNull(WebDomains.registrableHost("   "));
		assertNull(WebDomains.registrableHost("not a url at all"));
	}
}
