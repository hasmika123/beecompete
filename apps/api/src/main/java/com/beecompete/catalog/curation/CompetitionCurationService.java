package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.Category;
import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.EvaluationTypes;
import com.beecompete.catalog.domain.Organization;
import com.beecompete.catalog.domain.OrganizationType;
import com.beecompete.catalog.domain.ListingStatus;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.domain.ProvenanceSource;
import com.beecompete.catalog.repository.CategoryRepository;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.OrganizationRepository;
import com.beecompete.catalog.service.CategoryAttributeValidator;
import java.util.List;
import java.time.Instant;
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

	/** How many suffixed variants to try before giving up — far past any real collision run. */
	private static final int SLUG_SUFFIX_LIMIT = 50;

	/**
	 * The slug to actually store — and the one place the two create paths deliberately differ.
	 *
	 * <p><b>CURATED (a human filling in the admin form):</b> the slug is DERIVED from the name; the
	 * form has no slug field. A collision is therefore an ordinary event the curator cannot fix by
	 * editing anything, so we take the first free {@code -2}, {@code -3} … variant instead of
	 * failing the create with an error they have no lever against.
	 *
	 * <p><b>IMPORT (approving a queued extraction):</b> still a hard 409. There a slug collision is
	 * the strongest signal we have that the catalog ALREADY lists this competition, and quietly
	 * creating {@code mathcounts-2} would manufacture a near-duplicate — exactly what the queue's
	 * duplicate flag exists to prevent. Bulk approve leans on this too.
	 *
	 * <p>{@link #update} likewise keeps its 409: there the slug is a deliberate choice.
	 *
	 * <p>The unique index stays the real guard — two concurrent creates can both see a slug as
	 * free, and the loser gets a constraint violation rather than a duplicate row.
	 */
	private String slugFor(String requested, Provenance stamp) {
		boolean derived = stamp != null && stamp.getSource() == ProvenanceSource.CURATED;
		if (!competitions.existsBySlug(requested)) {
			return requested;
		}
		if (!derived) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "slug already exists: " + requested);
		}
		for (int n = 2; n < SLUG_SUFFIX_LIMIT; n++) {
			String candidate = requested + "-" + n;
			if (!competitions.existsBySlug(candidate)) {
				return candidate;
			}
		}
		throw new ResponseStatusException(HttpStatus.CONFLICT,
				"could not derive a free slug from: " + requested);
	}

	@Transactional
	public Competition create(CompetitionRequest request, Provenance stamp) {
		Category category = requireCategory(request.categoryId());
		validateAttributes(request);
		validateEvaluationTypes(request);
		Competition competition = new Competition(slugFor(request.slug(), stamp), request.name(), category,
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

	/**
	 * §8a lifecycle transition. Legal moves are {@link ListingStatus#canTransitionTo}; anything
	 * else is a 409 naming both states, so the admin UI can render why. First entry to PUBLISHED
	 * stamps {@code approved_at} (once — re-listing after an unlist does not re-stamp; the stamp
	 * answers "was this ever vetted", not "when was it last toggled"). An archived listing has no
	 * lifecycle to move — restore first.
	 */
	@Transactional
	public Competition transitionListingStatus(UUID id, ListingStatus next) {
		Competition competition = competitions.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "competition not found"));
		if (competition.getArchivedAt() != null) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "listing is archived — restore it first");
		}
		ListingStatus current = competition.getListingStatus();
		if (current == next) {
			return competition; // idempotent — a double-click is not an error
		}
		if (!current.canTransitionTo(next)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT,
					"cannot move a " + current + " listing to " + next);
		}
		competition.setListingStatus(next);
		if (next == ListingStatus.PUBLISHED && competition.getApprovedAt() == null) {
			competition.setApprovedAt(Instant.now());
		}
		return competition;
	}

	private void apply(Competition competition, CompetitionRequest request, Category category, Provenance stamp) {
		competition.setCategory(category);
		competition.setOrganizer(resolveOrganizer(request, stamp));
		competition.setOfficialUrl(request.officialUrl());
		competition.setLogo(request.logo());
		competition.setDescription(request.description());
		competition.setTags(request.tags());
		competition.setTeamSizeMin(request.teamSizeMin());
		competition.setTeamSizeMax(request.teamSizeMax());
		competition.setEvaluationType(request.evaluationType());
		competition.setEligibilityBasis(request.eligibilityBasis());
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
								+ "); restore it or pick another");
			}
			return exact; // decision (a): exact match → reuse
		}
		List<Organization> near = organizations
				.findByNameContainingIgnoreCase(name, PageRequest.of(0, 5)).getContent();
		if (!near.isEmpty() && !Boolean.TRUE.equals(request.confirmNewOrganizer())) {
			String candidates = near.stream()
					.map(o -> o.getId() + " · " + o.getName())
					.collect(Collectors.joining(", "));
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"no exact organizer match for '" + name + "' but similar organizations exist: " + candidates
							+ ". Set organizerOrgId to reuse one, or confirmNewOrganizer=true to create new.");
		}
		Organization created = new Organization(name, OrganizationType.HOST);
		created.setDomain(WebDomains.registrableHost(request.officialUrl()));
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
					"unknown evaluation type(s): " + String.join(", ", unknown) + "; allowed: "
							+ String.join(", ", EvaluationTypes.TOKENS.stream().sorted().toList()));
		}
	}
}
