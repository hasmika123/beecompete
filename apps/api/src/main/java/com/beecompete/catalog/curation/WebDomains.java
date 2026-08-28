package com.beecompete.catalog.curation;

import java.net.URI;

/**
 * Normalizes whatever someone typed for a website into the registrable host we store as an
 * Organization's {@code domain} — later the anchor for host verification (DQ11).
 *
 * <p>Extracted from {@code CompetitionCurationService} (where it served the auto-created orgs of
 * the resolve-or-create path) so the admin Organization endpoints can share it. Both write paths
 * now store the same shape, which is the point: a verification check that compares a domain cannot
 * work if one path saves {@code maa.org} and the other {@code https://www.maa.org/about}.
 */
public final class WebDomains {

	private WebDomains() {}

	/**
	 * The URL's host with a leading {@code www.} stripped and lowercased ({@code maa.org}). A value
	 * that is already a bare domain is returned as-is (lowercased), so a curator may type either.
	 * Null-safe: blank, malformed, or hostless input just leaves the domain unset rather than
	 * failing the write — a domain is optional metadata, not a gate.
	 */
	public static String registrableHost(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		String trimmed = value.trim();
		// A bare domain has no scheme, and URI would parse it as a path with a null host. Give it
		// one so the same extraction handles "maa.org" and "https://maa.org/x" identically.
		String candidate = trimmed.contains("://") ? trimmed : "https://" + trimmed;
		String host;
		try {
			host = URI.create(candidate).getHost();
		} catch (IllegalArgumentException e) {
			return null;
		}
		if (host == null) {
			return null;
		}
		host = host.toLowerCase();
		if (host.startsWith("www.")) {
			host = host.substring(4);
		}
		return host.isBlank() ? null : host;
	}
}
