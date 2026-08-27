package com.beecompete.platform.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * The header reaches a log line, so {@link CuratorAuditFilter#sanitize} is the security-relevant
 * part of the filter: a caller that can smuggle a newline into it can forge whole log entries and
 * make the audit trail say whatever they like.
 */
class CuratorAuditFilterTest {

	@Test
	void keepsARealAddress() {
		assertThat(CuratorAuditFilter.sanitize("  curator@beecompete.com  "))
				.isEqualTo("curator@beecompete.com");
	}

	@Test
	void treatsAbsentAndEmptyAsUnattributed() {
		assertThat(CuratorAuditFilter.sanitize(null)).isNull();
		assertThat(CuratorAuditFilter.sanitize("   ")).isNull();
	}

	@Test
	void stripsControlCharactersSoALogLineCannotBeForged() {
		String forged = "real@beecompete.com\n2026-01-01 INFO admin write DELETE /everything by ghost";
		assertThat(CuratorAuditFilter.sanitize(forged)).doesNotContain("\n").isEqualTo(
				"real@beecompete.com2026-01-01 INFO admin write DELETE /everything by ghost");
		assertThat(CuratorAuditFilter.sanitize("a\r\nb\tc")).isEqualTo("abc");
	}

	@Test
	void boundsTheLength() {
		assertThat(CuratorAuditFilter.sanitize("x".repeat(500))).hasSize(254);
	}
}
