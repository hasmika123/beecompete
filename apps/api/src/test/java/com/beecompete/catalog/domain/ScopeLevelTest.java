package com.beecompete.catalog.domain;

import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.persistence.Column;
import java.lang.reflect.Field;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

/**
 * Guards the thing that lets {@link ScopeLevel} grow without a migration: it is persisted as a
 * string into a plain {@code VARCHAR} with no CHECK constraint, so a new token costs nothing —
 * right up until one is longer than the column. INTERNATIONAL (added 2026-08-20) is 13 of 20.
 *
 * <p>The bound is read off the mapping rather than hardcoded, so widening or narrowing the column
 * keeps this test honest instead of silently stale.
 */
class ScopeLevelTest {

	@Test
	void everyTokenFitsTheMappedColumn() throws NoSuchFieldException {
		Field field = Edition.class.getDeclaredField("scopeLevel");
		int length = field.getAnnotation(Column.class).length();

		for (ScopeLevel level : ScopeLevel.values()) {
			assertTrue(level.name().length() <= length,
					() -> "ScopeLevel." + level.name() + " is " + level.name().length()
							+ " chars but edition.scope_level holds " + length
							+ " — widen the column in a new changeset before adding this token");
		}
	}

	@Test
	void internationalIsDistinctFromNational() {
		// The seeding sweep forced ISEF and FIRST Robotics into NATIONAL because no other token
		// existed. Pins the fix: multi-country reach has its own value.
		assertTrue(Arrays.asList(ScopeLevel.values()).contains(ScopeLevel.INTERNATIONAL));
	}
}
