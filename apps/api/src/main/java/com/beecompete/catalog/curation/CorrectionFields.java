package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.CorrectionSubjectType;
import java.util.Map;
import java.util.Set;

/**
 * The fields a {@code CorrectionProposal} payload may touch, per subject type (R1-3b). One
 * whitelist enforced at BOTH ends — public intake rejects unknown keys, and approve merges
 * only these keys — so a stored payload can never smuggle a write to anything else.
 *
 * <p>Deliberately excluded: identity/linkage fields the public has no business proposing
 * (slug — carries SEO; categoryId/organizerOrgId/advancesToEditionId — internal ids), the
 * schema-validated {@code attributes} bag, and curator-only resource fields (affiliate flag +
 * meta, display order). Field names must match the request-record components — asserted by
 * CorrectionFieldsTest.
 */
public final class CorrectionFields {

	private static final Map<CorrectionSubjectType, Set<String>> ALLOWED = Map.of(
			CorrectionSubjectType.COMPETITION,
			Set.of("name", "officialUrl", "description", "summary", "tags", "participationMode",
					"teamSizeMin", "teamSizeMax", "delivery", "entryPathway", "evaluationType",
					"minGrade", "maxGrade", "minAge", "maxAge", "costType", "recurrence"),
			CorrectionSubjectType.EDITION,
			Set.of("cycleLabel", "status", "registrationUrl", "entryFee", "currency", "ageCutoffDate",
					"prizeSummary", "prizeValue", "prizeCurrency", "scopeLevel"),
			CorrectionSubjectType.RESOURCE,
			Set.of("title", "url", "type"));

	private CorrectionFields() {}

	public static Set<String> allowed(CorrectionSubjectType subjectType) {
		return ALLOWED.get(subjectType);
	}
}
