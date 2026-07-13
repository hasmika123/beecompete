package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.curation.CurationStamps;
import com.beecompete.catalog.domain.Organization;
import com.beecompete.catalog.domain.OrganizationType;
import com.beecompete.catalog.domain.VerificationState;
import com.beecompete.catalog.repository.OrganizationRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * R1-3 admin CRUD for Organizations (organizer attribution + DQ13 — verification attaches to
 * the ORG). Delete = archive (curated party records follow D7).
 */
@RestController
@RequestMapping("/api/v1/admin/organizations")
@Transactional
public class OrganizationAdminController {

	private final OrganizationRepository organizations;

	public OrganizationAdminController(OrganizationRepository organizations) {
		this.organizations = organizations;
	}

	@GetMapping
	@Transactional(readOnly = true)
	public Page<OrganizationResponse> list(@RequestParam(defaultValue = "") String query,
			@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
		var pageable = PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100), Sort.by("name"));
		return organizations.findByNameContainingIgnoreCase(query, pageable).map(OrganizationResponse::from);
	}

	@GetMapping("/{id}")
	@Transactional(readOnly = true)
	public OrganizationResponse get(@PathVariable UUID id) {
		return OrganizationResponse.from(require(id));
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public OrganizationResponse create(@Valid @RequestBody OrganizationRequest request) {
		Organization organization = new Organization(request.name(), request.type());
		organization.setDomain(request.domain());
		organization.setProvenance(CurationStamps.curated());
		return OrganizationResponse.from(organizations.save(organization));
	}

	@PutMapping("/{id}")
	public OrganizationResponse update(@PathVariable UUID id, @Valid @RequestBody OrganizationRequest request) {
		Organization organization = require(id);
		organization.setName(request.name());
		organization.setType(request.type());
		organization.setDomain(request.domain());
		organization.setProvenance(CurationStamps.curated());
		return OrganizationResponse.from(organization);
	}

	@DeleteMapping("/{id}")
	public OrganizationResponse archive(@PathVariable UUID id) {
		Organization organization = require(id);
		organization.setArchivedAt(Instant.now());
		return OrganizationResponse.from(organization);
	}

	@PostMapping("/{id}/restore")
	public OrganizationResponse restore(@PathVariable UUID id) {
		Organization organization = require(id);
		organization.setArchivedAt(null);
		return OrganizationResponse.from(organization);
	}

	@PutMapping("/{id}/verification")
	public OrganizationResponse setVerification(@PathVariable UUID id,
			@Valid @RequestBody CompetitionAdminController.VerificationRequest request) {
		// R1-19 org trust ladder: CURATED (unclaimed) → CLAIMED → VERIFIED. UNVERIFIED is retired.
		if (request.state() == VerificationState.UNVERIFIED) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"organizations use CURATED (unclaimed), CLAIMED, or VERIFIED — not UNVERIFIED");
		}
		Organization organization = require(id);
		organization.setVerificationState(request.state());
		return OrganizationResponse.from(organization);
	}

	private Organization require(UUID id) {
		return organizations.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "organization not found"));
	}

	public record OrganizationRequest(@NotBlank @Size(max = 300) String name, @NotNull OrganizationType type,
			@Size(max = 255) String domain) {}

	public record OrganizationResponse(UUID id, String name, String type, String domain, String verificationState,
			Instant archivedAt, Instant createdAt, Instant updatedAt, int version) {
		static OrganizationResponse from(Organization o) {
			return new OrganizationResponse(o.getId(), o.getName(), o.getType().name(), o.getDomain(),
					o.getVerificationState().name(), o.getArchivedAt(), o.getCreatedAt(), o.getUpdatedAt(),
					o.getVersion());
		}
	}
}
