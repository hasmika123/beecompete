package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.domain.Region;
import com.beecompete.catalog.domain.RegionLevel;
import com.beecompete.catalog.repository.RegionRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * R1-3 minimal Region admin: list + create, enough to tag Editions (Q3). The natural-key
 * unique constraint (parent, level, name) rejects duplicates at the DB.
 */
@RestController
@RequestMapping("/api/v1/admin/regions")
@Transactional
public class RegionAdminController {

	private final RegionRepository regions;

	public RegionAdminController(RegionRepository regions) {
		this.regions = regions;
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
		if (request.parentId() != null) {
			region.setParent(regions.findById(request.parentId()).orElseThrow(
					() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "unknown parent region")));
		}
		return RegionResponse.from(regions.save(region));
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
