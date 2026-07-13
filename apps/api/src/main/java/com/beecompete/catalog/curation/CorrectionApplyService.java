package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.CorrectionProposal;
import com.beecompete.catalog.domain.CorrectionSubjectType;
import com.beecompete.catalog.domain.Edition;
import com.beecompete.catalog.domain.Resource;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.EditionRepository;
import com.beecompete.catalog.repository.ResourceRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Applies an approved {@link CorrectionProposal} diff to its subject record (R1-3b, DQ6/D7):
 * current record → request shape → merge the whitelisted payload keys → Bean-validate → write
 * through the single curation write path (so slug/category/attribute invariants + provenance
 * stamping hold exactly as for a direct admin edit). The R1 audit record is the reviewed
 * proposal row itself + the provenance stamp; ActivityEvent logging arrives with R2-9.
 */
@Service
public class CorrectionApplyService {

	private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};

	private final CompetitionRepository competitions;
	private final EditionRepository editions;
	private final ResourceRepository resources;
	private final CompetitionCurationService competitionCuration;
	private final EditionCurationService editionCuration;
	private final ResourceCurationService resourceCuration;
	private final ObjectMapper mapper;
	private final Validator validator;

	public CorrectionApplyService(CompetitionRepository competitions, EditionRepository editions,
			ResourceRepository resources, CompetitionCurationService competitionCuration,
			EditionCurationService editionCuration, ResourceCurationService resourceCuration,
			ObjectMapper mapper, Validator validator) {
		this.competitions = competitions;
		this.editions = editions;
		this.resources = resources;
		this.competitionCuration = competitionCuration;
		this.editionCuration = editionCuration;
		this.resourceCuration = resourceCuration;
		this.mapper = mapper;
		this.validator = validator;
	}

	/** 422 unless every payload key is whitelisted for the subject type and the payload is non-empty. */
	public void requireWhitelisted(CorrectionSubjectType subjectType, Map<String, Object> payload) {
		if (payload == null || payload.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "payload must not be empty");
		}
		Set<String> allowed = CorrectionFields.allowed(subjectType);
		Set<String> unknown = payload.keySet().stream()
				.filter(key -> !allowed.contains(key))
				.collect(Collectors.toCollection(java.util.TreeSet::new));
		if (!unknown.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"fields not open to correction: " + String.join(", ", unknown));
		}
	}

	/** 422 if the subject row doesn't exist (public intake existence gate — catalog data is public anyway). */
	public void requireSubjectExists(CorrectionSubjectType subjectType, UUID subjectId) {
		boolean exists = switch (subjectType) {
			case COMPETITION -> competitions.existsById(subjectId);
			case EDITION -> editions.existsById(subjectId);
			case RESOURCE -> resources.existsById(subjectId);
		};
		if (!exists) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"unknown " + subjectType.name().toLowerCase() + ": " + subjectId);
		}
	}

	/**
	 * The subject's current values for the whitelisted fields — the review UI's "current vs
	 * proposed" panel. Must run inside a transaction (reads lazy relations).
	 */
	@Transactional(readOnly = true)
	public Map<String, Object> currentValues(CorrectionSubjectType subjectType, UUID subjectId) {
		Map<String, Object> full = mapper.convertValue(currentRequest(subjectType, subjectId), MAP);
		Set<String> allowed = CorrectionFields.allowed(subjectType);
		Map<String, Object> current = new LinkedHashMap<>();
		full.forEach((key, value) -> {
			if (allowed.contains(key)) {
				current.put(key, value);
			}
		});
		return current;
	}

	/**
	 * Human-readable subject names for a page of proposals, keyed by PROPOSAL id — the queue
	 * list's "Subject" column. Batched: subject ids grouped per type, at most one query each
	 * (editions join-fetch their competition), never N+1 from the web. A vanished subject
	 * (hard-deleted resource) simply has no entry — callers render the raw id as the fallback.
	 */
	@Transactional(readOnly = true)
	public Map<UUID, String> subjectNames(List<CorrectionProposal> proposals) {
		Map<UUID, String> bySubject = new HashMap<>();
		Set<UUID> competitionIds = subjectIds(proposals, CorrectionSubjectType.COMPETITION);
		Set<UUID> editionIds = subjectIds(proposals, CorrectionSubjectType.EDITION);
		Set<UUID> resourceIds = subjectIds(proposals, CorrectionSubjectType.RESOURCE);
		if (!competitionIds.isEmpty()) {
			competitions.findAllById(competitionIds).forEach(c -> bySubject.put(c.getId(), c.getName()));
		}
		if (!editionIds.isEmpty()) {
			editions.findAllWithCompetitionByIdIn(editionIds).forEach(
					e -> bySubject.put(e.getId(), e.getCompetition().getName() + " · " + e.getCycleLabel()));
		}
		if (!resourceIds.isEmpty()) {
			resources.findAllById(resourceIds).forEach(r -> bySubject.put(r.getId(), r.getTitle()));
		}
		Map<UUID, String> byProposal = new HashMap<>();
		proposals.forEach(p -> {
			String name = bySubject.get(p.getSubjectId());
			if (name != null) {
				byProposal.put(p.getId(), name);
			}
		});
		return byProposal;
	}

	private static Set<UUID> subjectIds(List<CorrectionProposal> proposals, CorrectionSubjectType type) {
		return proposals.stream()
				.filter(p -> p.getSubjectType() == type)
				.map(CorrectionProposal::getSubjectId)
				.collect(Collectors.toSet());
	}

	/** Merge the diff into the current record and write it. Returns a short summary for the review note. */
	@Transactional
	public String apply(CorrectionProposal proposal, Map<String, Object> payload) {
		CorrectionSubjectType subjectType = proposal.getSubjectType();
		UUID subjectId = proposal.getSubjectId();
		requireWhitelisted(subjectType, payload);
		Map<String, Object> merged = mapper.convertValue(currentRequest(subjectType, subjectId), MAP);
		merged.putAll(payload);
		switch (subjectType) {
			case COMPETITION -> competitionCuration.update(subjectId,
					convert(merged, CompetitionRequest.class), CurationStamps.curated());
			case EDITION -> editionCuration.update(subjectId,
					convert(merged, EditionRequest.class), CurationStamps.curated());
			case RESOURCE -> resourceCuration.update(subjectId, convert(merged, ResourceRequest.class));
		}
		return "applied " + String.join(", ", payload.keySet()) + " to "
				+ subjectType.name().toLowerCase() + " " + subjectId;
	}

	private Object currentRequest(CorrectionSubjectType subjectType, UUID subjectId) {
		return switch (subjectType) {
			case COMPETITION -> {
				Competition c = competitions.findById(subjectId).orElseThrow(this::subjectGone);
				yield new CompetitionRequest(c.getSlug(), c.getName(),
						c.getOrganizer() != null ? c.getOrganizer().getId() : null, c.getOfficialUrl(),
						c.getLogo(), c.getDescription(), c.getSummary(), c.getCategory().getId(), c.getTags(),
						c.getParticipationMode(), c.getTeamSizeMin(), c.getTeamSizeMax(), c.getDelivery(),
						c.getEntryPathway(), c.getEvaluationType(), c.getMinGrade(), c.getMaxGrade(),
						c.getMinAge(), c.getMaxAge(), c.getCostType(), c.getRecurrence(), c.getAttributes());
			}
			case EDITION -> {
				Edition e = editions.findById(subjectId).orElseThrow(this::subjectGone);
				yield new EditionRequest(e.getCycleLabel(), e.getStatus(), e.getRegistrationUrl(),
						e.getEntryFee(), e.getCurrency(), e.getAgeCutoffDate(), e.getPrizeSummary(),
						e.getPrizeValue(), e.getPrizeCurrency(), e.getScopeLevel(),
						e.getAdvancesTo() != null ? e.getAdvancesTo().getId() : null, e.getAttributes());
			}
			case RESOURCE -> {
				Resource r = resources.findById(subjectId).orElseThrow(this::subjectGone);
				yield new ResourceRequest(r.getTitle(), r.getUrl(), r.getType(), r.isAffiliate(),
						r.getAffiliateMeta(), r.getDisplayOrder());
			}
		};
	}

	private ResponseStatusException subjectGone() {
		return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "subject record no longer exists");
	}

	private <T> T convert(Map<String, Object> merged, Class<T> requestType) {
		T request;
		try {
			request = mapper.convertValue(merged, requestType);
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"payload does not apply: " + e.getMessage());
		}
		Set<ConstraintViolation<T>> violations = validator.validate(request);
		if (!violations.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "merged record invalid: "
					+ violations.stream()
							.map(v -> v.getPropertyPath() + " " + v.getMessage())
							.collect(Collectors.joining("; ")));
		}
		return request;
	}
}
