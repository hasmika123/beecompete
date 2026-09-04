package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.curation.CurationStamps;
import com.beecompete.catalog.curation.DuplicateDetectionService;
import com.beecompete.catalog.curation.WebDomains;
import com.beecompete.catalog.domain.Organization;
import com.beecompete.catalog.domain.OrganizationType;
import com.beecompete.catalog.domain.VerificationState;
import com.beecompete.catalog.repository.OrganizationRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
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
	private final DuplicateDetectionService duplicates;

	public OrganizationAdminController(OrganizationRepository organizations, DuplicateDetectionService duplicates) {
		this.organizations = organizations;
		this.duplicates = duplicates;
	}

	@GetMapping
	@Transactional(readOnly = true)
	public Page<OrganizationResponse> list(@RequestParam(defaultValue = "") String query,
			@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
		var pageable = PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100), Sort.by("name"));
		return organizations.findByNameContainingIgnoreCase(query, pageable).map(OrganizationResponse::from);
	}

	/**
	 * Duplicate candidates for an organization about to be saved (DQ4) — the same lookup the create
	 * and update gates run, exposed so the form can warn before submit. {@code excludeId} on edit.
	 */
	@GetMapping("/duplicates")
	@Transactional(readOnly = true)
	public List<DuplicateDetectionService.OrganizationCandidate> duplicates(
			@RequestParam(required = false) String name, @RequestParam(required = false) String domain,
			@RequestParam(required = false) UUID excludeId) {
		return duplicates.findOrganization(name, WebDomains.registrableHost(domain), excludeId);
	}

	@GetMapping("/{id}")
	@Transactional(readOnly = true)
	public OrganizationResponse get(@PathVariable UUID id) {
		return OrganizationResponse.from(require(id));
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public OrganizationResponse create(@Valid @RequestBody OrganizationRequest request) {
		// Normalized, not stored raw: the admin form asks for the "official website", so a curator
		// may reasonably paste https://www.maa.org/amc. Host verification (DQ11) compares DOMAINS,
		// and the resolve-or-create path already stores the registrable host — both write paths have
		// to agree or that comparison silently fails on whichever rows came in through this one.
		String domain = WebDomains.registrableHost(request.domain());
		guardDuplicates(request, domain, null);
		Organization organization = new Organization(request.name().trim(), request.type());
		organization.setDomain(domain);
		organization.setProvenance(CurationStamps.curated());
		return OrganizationResponse.from(organizations.save(organization));
	}

	@PutMapping("/{id}")
	public OrganizationResponse update(@PathVariable UUID id, @Valid @RequestBody OrganizationRequest request) {
		Organization organization = require(id);
		String domain = WebDomains.registrableHost(request.domain());
		// Only a changed name or domain can create a new collision (same rule as competitions).
		if (!DuplicateDetectionService.sameText(organization.getName(), request.name())
				|| !DuplicateDetectionService.sameText(organization.getDomain(), domain)) {
			guardDuplicates(request, domain, id);
		}
		organization.setName(request.name().trim());
		organization.setType(request.type());
		organization.setDomain(domain);
		organization.setProvenance(CurationStamps.curated());
		return OrganizationResponse.from(organization);
	}

	/**
	 * The one organization write path that had no duplicate check at all until DQ4. Mirrors the
	 * organizer resolver's rules: a LIVE organization with the same name key is a 409 pointing at
	 * it (reuse it — or, since org names carry no unique index, rename if it truly is another);
	 * an archived exact match, the same registrable domain, or a similar name is a 422 listing the
	 * candidates unless the curator set {@code confirmNotDuplicate}.
	 */
	private void guardDuplicates(OrganizationRequest request, String domain, UUID selfId) {
		List<DuplicateDetectionService.OrganizationCandidate> candidates = duplicates.findOrganization(request.name(),
				domain, selfId);
		if (candidates.isEmpty()) {
			return;
		}
		DuplicateDetectionService.OrganizationCandidate liveExact = candidates.stream()
				.filter(DuplicateDetectionService.OrganizationCandidate::isLiveExact).findFirst().orElse(null);
		if (liveExact != null) {
			throw new ResponseStatusException(HttpStatus.CONFLICT,
					"an organization already has this name: " + liveExact.name() + " (" + liveExact.id()
							+ "). Use it, or rename this one to tell them apart.");
		}
		if (!Boolean.TRUE.equals(request.confirmNotDuplicate())) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"possible duplicate of: " + DuplicateDetectionService.describeOrganizations(candidates)
							+ ". Set confirmNotDuplicate=true to save it anyway.");
		}
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
					"organizations use CURATED (unclaimed), CLAIMED, or VERIFIED, not UNVERIFIED");
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
			@Size(max = 255) String domain,
			/** Curator override for the soft duplicate signals (DQ4) — never for a live exact name. */
			Boolean confirmNotDuplicate) {}

	public record OrganizationResponse(UUID id, String name, String type, String domain, String verificationState,
			Instant archivedAt, Instant createdAt, Instant updatedAt, int version) {
		static OrganizationResponse from(Organization o) {
			return new OrganizationResponse(o.getId(), o.getName(), o.getType().name(), o.getDomain(),
					o.getVerificationState().name(), o.getArchivedAt(), o.getCreatedAt(), o.getUpdatedAt(),
					o.getVersion());
		}
	}
}
