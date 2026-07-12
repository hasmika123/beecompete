package com.beecompete.catalog.curation;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.beecompete.catalog.domain.CorrectionSubjectType;
import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/**
 * Pins the correction whitelists (R1-3b) to the real request-record shapes: every whitelisted
 * field must be a component of the record the diff merges into (a rename there must break
 * here), and the identity/linkage fields must stay excluded.
 */
class CorrectionFieldsTest {

	@Test
	void whitelistedFieldsExistOnTheRequestRecords() {
		assertSubset(CorrectionSubjectType.COMPETITION, CompetitionRequest.class);
		assertSubset(CorrectionSubjectType.EDITION, EditionRequest.class);
		assertSubset(CorrectionSubjectType.RESOURCE, ResourceRequest.class);
	}

	@Test
	void identityAndLinkageFieldsStayExcluded() {
		assertFalse(CorrectionFields.allowed(CorrectionSubjectType.COMPETITION).contains("slug"));
		assertFalse(CorrectionFields.allowed(CorrectionSubjectType.COMPETITION).contains("categoryId"));
		assertFalse(CorrectionFields.allowed(CorrectionSubjectType.COMPETITION).contains("organizerOrgId"));
		assertFalse(CorrectionFields.allowed(CorrectionSubjectType.COMPETITION).contains("attributes"));
		assertFalse(CorrectionFields.allowed(CorrectionSubjectType.EDITION).contains("advancesToEditionId"));
		assertFalse(CorrectionFields.allowed(CorrectionSubjectType.RESOURCE).contains("isAffiliate"));
	}

	private void assertSubset(CorrectionSubjectType subjectType, Class<?> recordType) {
		Set<String> components = Arrays.stream(recordType.getRecordComponents())
				.map(RecordComponent::getName)
				.collect(Collectors.toSet());
		for (String field : CorrectionFields.allowed(subjectType)) {
			assertTrue(components.contains(field),
					subjectType + " whitelists '" + field + "' but " + recordType.getSimpleName()
							+ " has no such component");
		}
	}
}
