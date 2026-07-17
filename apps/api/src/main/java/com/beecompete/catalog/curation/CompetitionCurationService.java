package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.Category;
import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.EvaluationTypes;
import com.beecompete.catalog.domain.Organization;
import com.beecompete.catalog.domain.OrganizationType;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.repository.CategoryRepository;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.OrganizationRepository;
import com.beecompete.catalog.service.CategoryAttributeValidator;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Applies a {@link CompetitionRequest} to a Competition — the single write path used by the
 * admin CRUD controller AND the import-queue approve. Enforces the two invariants every
 * competition write must satisfy: the {@code attributes} bag conforms to its Category Template
 * (D1), and a provenance stamp is applied (R1-3 rule).
 */
@Service
public class CompetitionCurationService {

	private final CompetitionRepository competitions;
	private final CategoryRepository categories;
	private final OrganizationRepository organizations;
	private final CategoryAttributeValidator attributeValidator;

	public CompetitionCurationService(CompetitionRepository competitions, CategoryRepository categories,
			OrganizationRepository organizations, CategoryAttributeValidator attributeValidator) {
		this.competitions = competitions;
		this.categories = categories;
		this.organizations = organizations;
		this.attributeValidator = attributeValidator;
	}

	@Transactional
	public Competition create(CompetitionRequest request, Provenance stamp) {
		if (competitions.existsBySlug(request.slug())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "slug already exists: " + request.slug());
		}
		Category category = requireCategory(request.categoryId());
		validateAttributes(request);
		validateEvaluationTypes(request);
		Competition competition = new Competition(request.slug(), request.name(), category,
				request.participationMode(), request.delivery(), request.entryPathway(), request.costType(),
				request.recurrence());
		apply(competition, request, category, stamp);
		return competitions.save(competition);
	}

	@Transactional
	public Competition update(UUID id, CompetitionRequest request, Provenance stamp) {
		Competition competition = competitions.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "competition not found"));
		if (!competition.getSlug().equals(request.slug()) && competitions.existsBySlug(request.slug())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "slug already exists: " + request.slug());
		}
		Category category = requireCategory(request.categoryId());
		validateAttributes(request);
		validateEvaluationTypes(request);
		competition.setSlug(request.slug());
		competition.setName(request.name());
		competition.setParticipationMode(request.participationMode());
		competition.setDelivery(request.delivery());
		competition.setEntryPathway(request.entryPathway());
		competition.setCostType(request.costType());
		competition.setRecurrence(request.recurrence());
		apply(competition, request, category, stamp);
		return competition;
	}

	private void apply(Competition competition, CompetitionRequest request, Category category, Provenance stamp) {
		competition.setCategory(category);
		competition.setOrganizer(resolveOrganizer(request, stamp));
		competition.setOfficialUrl(request.officialUrl());
		competition.setLogo(request.logo());
		competition.setDescription(request.description());
		competition.setSummary(request.summary());
		competition.setTags(request.tags());
		competition.setTeamSizeMin(request.teamSizeMin());
		competition.setTeamSizeMax(request.teamSizeMax());
		competition.setEvaluationType(request.evaluationType());
		competition.setMinGrade(request.minGrade());
		competition.setMaxGrade(request.maxGrade());
		competition.setMinAge(request.minAge());
		competition.setMaxAge(request.maxAge());
		competition.setAttributes(request.attributes());
		competition.setProvenance(stamp);
	}

	private Category requireCategory(UUID categoryId) {
		return categories.findById(categoryId).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "unknown category"));
	}

	/**
	 * Resolve-or-create the organizer. A given {@code organizerOrgId} must exist (422 otherwise) —
	 * unchanged behavior. Otherwise resolve by {@code organizerName}: an exact (normalized,
	 * case-insensitive) name match is REUSED; a name that only matches SIMILAR orgs is refused (422
	 * listing the candidates) unless the curator set {@code confirmNewOrganizer}; a name with no
	 * match creates a fresh CURATED/HOST org (domain inferred from the official URL, same provenance
	 * stamp as the competition). Conservative on purpose (decision a): a wrong merge is worse than a
	 * duplicate, so only containment matches flag — no fuzzy/acronym matching, no auto-merge.
	 */
	private Organization resolveOrganizer(CompetitionRequest request, Provenance stamp) {
		if (request.organizerOrgId() != null) {
			return organizations.findById(request.organizerOrgId()).orElseThrow(
					() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "unknown organizer org"));
		}
		String name = normalizeOrgName(request.organizerName());
		if (name == null) {
			// The @AssertTrue on CompetitionRequest guards the @Valid controller paths; this covers
			// direct service calls and keeps the resolver from NPE-ing on a blank name.
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"organizer is required: pass organizerOrgId or organizerName");
		}
		Organization exact = organizations.findByNameIgnoreCase(name).orElse(null);
		if (exact != null) {
			if (exact.getArchivedAt() != null) {
				throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
						"organizer name matches an archived organization (" + exact.getId()
								+ ") — restore it or pick another");
			}
			return exact; // decision (a): exact match → reuse
		}
		List<Organization> near = organizations
				.findByNameContainingIgnoreCase(name, PageRequest.of(0, 5)).getContent();
		if (!near.isEmpty() && !Boolean.TRUE.equals(request.confirmNewOrganizer())) {
			String candidates = near.stream()
					.map(o -> o.getId() + " — " + o.getName())
					.collect(Collectors.joining(", "));
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"no exact organizer match for '" + name + "' but similar organizations exist: " + candidates
							+ ". Set organizerOrgId to reuse one, or confirmNewOrganizer=true to create new.");
		}
		Organization created = new Organization(name, OrganizationType.HOST);
		created.setDomain(registrableHost(request.officialUrl()));
		created.setProvenance(stamp); // same stamp as the competition; verificationState defaults CURATED
		return organizations.save(created);
	}

	/** Trim + collapse inner whitespace; null/blank → null (no organizer name given). */
	private static String normalizeOrgName(String raw) {
		if (raw == null) {
			return null;
		}
		String collapsed = raw.trim().replaceAll("\\s+", " ");
		return collapsed.isEmpty() ? null : collapsed;
	}

	/**
	 * Registrable host for the new org's domain (later the anchor for host verification, DQ11).
	 * Naive: the URL host with a leading {@code www.} stripped (e.g. maa.org). Null-safe — a missing
	 * or malformed URL just leaves the domain unset.
	 */
	private static String registrableHost(String officialUrl) {
		if (officialUrl == null || officialUrl.isBlank()) {
			return null;
		}
		String host;
		try {
			host = URI.create(officialUrl.trim()).getHost();
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

	private void validateAttributes(CompetitionRequest request) {
		List<String> problems = attributeValidator.validate(request.categoryId(), request.attributes());
		if (!problems.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"attributes do not match the category template: " + String.join("; ", problems));
		}
	}

	/** Evaluation-type tokens are a canonical lowercase set (R1-5 "format" facet, glossary: Format). */
	private void validateEvaluationTypes(CompetitionRequest request) {
		if (request.evaluationType() == null) {
			return;
		}
		List<String> unknown = request.evaluationType().stream()
				.filter(token -> !EvaluationTypes.TOKENS.contains(token))
				.toList();
		if (!unknown.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"unknown evaluation type(s): " + String.join(", ", unknown) + " — allowed: "
							+ String.join(", ", EvaluationTypes.TOKENS.stream().sorted().toList()));
		}
	}
}
