package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.Resource;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.ResourceRepository;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Applies a {@link ResourceRequest} to a Resource — the single write path used by the admin
 * CRUD controller AND the correction-queue approve (R1-3b). Resources carry no provenance
 * column; the affiliate flag drives the required disclosure (🔒 R1-8).
 */
@Service
public class ResourceCurationService {

	private final ResourceRepository resources;
	private final CompetitionRepository competitions;

	public ResourceCurationService(ResourceRepository resources, CompetitionRepository competitions) {
		this.resources = resources;
		this.competitions = competitions;
	}

	@Transactional
	public Resource create(UUID competitionId, ResourceRequest request) {
		Competition competition = competitions.findById(competitionId).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "competition not found"));
		Resource resource = new Resource(competition, request.title(), request.url(), request.type());
		apply(resource, request);
		return resources.save(resource);
	}

	@Transactional
	public Resource update(UUID id, ResourceRequest request) {
		Resource resource = resources.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "resource not found"));
		resource.setTitle(request.title());
		resource.setUrl(request.url());
		resource.setType(request.type());
		apply(resource, request);
		return resource;
	}

	private void apply(Resource resource, ResourceRequest request) {
		resource.setAffiliate(request.isAffiliate());
		resource.setAffiliateMeta(request.affiliateMeta());
		resource.setDisplayOrder(request.displayOrder());
	}
}
