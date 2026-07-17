package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.domain.Region;
import com.beecompete.catalog.domain.RegionLevel;
import com.beecompete.catalog.repository.EditionRegionRepository;
import com.beecompete.catalog.repository.RegionRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * R1-3 Region admin: full CRUD (list/create/update/delete), enough to curate the geo tree that
 * tags Editions (Q3). The natural-key unique constraint (parent, level, name) rejects
 * duplicates at the DB; delete is guarded against orphaning child regions or edition tags.
 */
@RestController
@RequestMapping("/api/v1/admin/regions")
@Transactional
public class RegionAdminController {

	private final RegionRepository regions;
	private final EditionRegionRepository editionRegions;

	public RegionAdminController(RegionRepository regions, EditionRegionRepository editionRegions) {
		this.regions = regions;
		this.editionRegions = editionRegions;
	}

	@GetMapping
	@Transactional(readOnly = true)
	public List<RegionResponse> list() {
		return regions.findAll().stream().map(RegionResponse::from).toList();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public RegionResponse create(@Valid @RequestBody RegionRequest request) {
		Region region = new Region(request.level(), request.name());
		region.setCode(request.code());
		region.setParent(resolveParent(request.parentId(), null));
		return RegionResponse.from(regions.save(region));
	}

	@PutMapping("/{id}")
	public RegionResponse update(@PathVariable UUID id, @Valid @RequestBody RegionRequest request) {
		Region region = require(id);
		region.setLevel(request.level());
		region.setName(request.name());
		region.setCode(request.code());
		region.setParent(resolveParent(request.parentId(), id));
		return RegionResponse.from(region);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable UUID id) {
		require(id);
		if (regions.existsByParentId(id)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT,
					"region has child regions — remove or reparent them first");
		}
		if (editionRegions.existsByRegionId(id)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT,
					"region is still tagged on one or more editions — untag it there first");
		}
		regions.deleteById(id);
	}

	/** Resolve + validate a parent id: must exist and (on update) not be the region itself. */
	private Region resolveParent(UUID parentId, UUID selfId) {
		if (parentId == null) {
			return null;
		}
		if (parentId.equals(selfId)) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "a region can't be its own parent");
		}
		return regions.findById(parentId).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "unknown parent region"));
	}

	private Region require(UUID id) {
		return regions.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "region not found"));
	}

	public record RegionRequest(UUID parentId, @NotNull RegionLevel level, @NotBlank @Size(max = 160) String name,
			@Size(max = 20) String code) {}

	public record RegionResponse(UUID id, UUID parentId, String level, String name, String code) {
		static RegionResponse from(Region r) {
			return new RegionResponse(r.getId(), r.getParent() != null ? r.getParent().getId() : null,
					r.getLevel().name(), r.getName(), r.getCode());
		}
	}
}
