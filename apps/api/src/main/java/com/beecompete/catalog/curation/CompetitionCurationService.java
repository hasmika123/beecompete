package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.Category;
import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.EvaluationTypes;
import com.beecompete.catalog.domain.Organization;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.repository.CategoryRepository;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.OrganizationRepository;
import com.beecompete.catalog.service.CategoryAttributeValidator;
import java.util.List;
import java.util.UUID;
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
		competition.setOrganizer(resolveOrganizer(request.organizerOrgId()));
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

	private Organization resolveOrganizer(UUID organizerOrgId) {
		if (organizerOrgId == null) {
			return null;
		}
		return organizations.findById(organizerOrgId).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "unknown organizer org"));
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
