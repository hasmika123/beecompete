package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.curation.CompetitionCurationService;
import com.beecompete.catalog.curation.CompetitionRequest;
import com.beecompete.catalog.curation.CurationStamps;
import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.CompetitionFaq;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.domain.Resource;
import com.beecompete.catalog.domain.ResourceType;
import com.beecompete.catalog.domain.VerificationState;
import com.beecompete.catalog.repository.CompetitionFaqRepository;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.ResourceRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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
 * R1-3 admin CRUD for Competitions + their FAQ entries and Resources. Gated by
 * {@link com.beecompete.platform.web.AdminTokenFilter}. Delete = ARCHIVE (soft-delete, D7 —
 * slugs carry SEO); FAQ/Resource child rows hard-delete. Every write stamps provenance.
 *
 * <p>{@code @Transactional} at the controller: for admin v0 these controllers ARE the service
 * boundary (no separate app service layer yet) — it keeps lazy relations readable during
 * response mapping (OSIV is off) and writes atomic.
 */
@RestController
@RequestMapping("/api/v1/admin")
@Transactional
public class CompetitionAdminController {

	private final CompetitionRepository competitions;
	private final CompetitionFaqRepository faqs;
	private final ResourceRepository resources;
	private final CompetitionCurationService curation;

	public CompetitionAdminController(CompetitionRepository competitions, CompetitionFaqRepository faqs,
			ResourceRepository resources, CompetitionCurationService curation) {
		this.competitions = competitions;
		this.faqs = faqs;
		this.resources = resources;
		this.curation = curation;
	}

	@GetMapping("/competitions")
	@Transactional(readOnly = true)
	public Page<CompetitionResponse> list(@RequestParam(defaultValue = "") String query,
			@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
		var pageable = PageRequest.of(page, Math.min(size, 100), Sort.by("name"));
		return competitions.findByNameContainingIgnoreCase(query, pageable).map(CompetitionResponse::from);
	}

	@GetMapping("/competitions/{id}")
	@Transactional(readOnly = true)
	public CompetitionResponse get(@PathVariable UUID id) {
		return CompetitionResponse.from(require(id));
	}

	@PostMapping("/competitions")
	@ResponseStatus(HttpStatus.CREATED)
	public CompetitionResponse create(@Valid @RequestBody CompetitionRequest request) {
		return CompetitionResponse.from(curation.create(request, CurationStamps.curated()));
	}

	@PutMapping("/competitions/{id}")
	public CompetitionResponse update(@PathVariable UUID id, @Valid @RequestBody CompetitionRequest request) {
		return CompetitionResponse.from(curation.update(id, request, CurationStamps.curated()));
	}

	/** Soft-delete (D7): archived listings vanish from the public catalog but keep their slug. */
	@DeleteMapping("/competitions/{id}")
	public CompetitionResponse archive(@PathVariable UUID id) {
		Competition competition = require(id);
		competition.setArchivedAt(Instant.now());
		return CompetitionResponse.from(competition);
	}

	@PostMapping("/competitions/{id}/restore")
	public CompetitionResponse restore(@PathVariable UUID id) {
		Competition competition = require(id);
		competition.setArchivedAt(null);
		return CompetitionResponse.from(competition);
	}

	/** Explicit verification-state control (DQ13) — never a side effect of other edits. */
	@PutMapping("/competitions/{id}/verification")
	public CompetitionResponse setVerification(@PathVariable UUID id, @Valid @RequestBody VerificationRequest request) {
		Competition competition = require(id);
		competition.setVerificationState(request.state());
		return CompetitionResponse.from(competition);
	}

	// --- FAQ entries (glossary: FAQ Entry; details FAQ tab — R1-7) ---

	@GetMapping("/competitions/{id}/faqs")
	@Transactional(readOnly = true)
	public List<FaqResponse> listFaqs(@PathVariable UUID id) {
		require(id);
		return faqs.findByCompetitionIdOrderByDisplayOrder(id).stream().map(FaqResponse::from).toList();
	}

	@PostMapping("/competitions/{id}/faqs")
	@ResponseStatus(HttpStatus.CREATED)
	public FaqResponse createFaq(@PathVariable UUID id, @Valid @RequestBody FaqRequest request) {
		Competition competition = require(id);
		return FaqResponse.from(faqs.save(
				new CompetitionFaq(competition, request.question(), request.answer(), request.displayOrder())));
	}

	@PutMapping("/faqs/{faqId}")
	public FaqResponse updateFaq(@PathVariable UUID faqId, @Valid @RequestBody FaqRequest request) {
		CompetitionFaq faq = faqs.findById(faqId).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "faq not found"));
		faq.setQuestion(request.question());
		faq.setAnswer(request.answer());
		faq.setDisplayOrder(request.displayOrder());
		return FaqResponse.from(faq);
	}

	@DeleteMapping("/faqs/{faqId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteFaq(@PathVariable UUID faqId) {
		faqs.deleteById(faqId);
	}

	// --- Resources (curated prep links — R1-8; affiliate flag drives the disclosure 🔒) ---

	@GetMapping("/competitions/{id}/resources")
	@Transactional(readOnly = true)
	public List<ResourceResponse> listResources(@PathVariable UUID id) {
		require(id);
		return resources.findByCompetitionIdOrderByDisplayOrder(id).stream().map(ResourceResponse::from).toList();
	}

	@PostMapping("/competitions/{id}/resources")
	@ResponseStatus(HttpStatus.CREATED)
	public ResourceResponse createResource(@PathVariable UUID id, @Valid @RequestBody ResourceRequest request) {
		Competition competition = require(id);
		Resource resource = new Resource(competition, request.title(), request.url(), request.type());
		applyResource(resource, request);
		return ResourceResponse.from(resources.save(resource));
	}

	@PutMapping("/resources/{resourceId}")
	public ResourceResponse updateResource(@PathVariable UUID resourceId, @Valid @RequestBody ResourceRequest request) {
		Resource resource = resources.findById(resourceId).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "resource not found"));
		resource.setTitle(request.title());
		resource.setUrl(request.url());
		resource.setType(request.type());
		applyResource(resource, request);
		return ResourceResponse.from(resource);
	}

	@DeleteMapping("/resources/{resourceId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteResource(@PathVariable UUID resourceId) {
		resources.deleteById(resourceId);
	}

	private void applyResource(Resource resource, ResourceRequest request) {
		resource.setAffiliate(request.isAffiliate());
		resource.setAffiliateMeta(request.affiliateMeta());
		resource.setDisplayOrder(request.displayOrder());
	}

	private Competition require(UUID id) {
		return competitions.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "competition not found"));
	}

	// --- DTOs ---

	public record VerificationRequest(@NotNull VerificationState state) {}

	public record FaqRequest(@NotBlank @Size(max = 500) String question, @NotBlank String answer,
			short displayOrder) {}

	public record FaqResponse(UUID id, String question, String answer, short displayOrder) {
		static FaqResponse from(CompetitionFaq faq) {
			return new FaqResponse(faq.getId(), faq.getQuestion(), faq.getAnswer(), faq.getDisplayOrder());
		}
	}

	public record ResourceRequest(@NotBlank @Size(max = 300) String title, @NotBlank @Size(max = 1000) String url,
			@NotNull ResourceType type, boolean isAffiliate, Map<String, Object> affiliateMeta,
			short displayOrder) {}

	public record ResourceResponse(UUID id, String title, String url, ResourceType type, boolean isAffiliate,
			Map<String, Object> affiliateMeta, short displayOrder) {
		static ResourceResponse from(Resource r) {
			return new ResourceResponse(r.getId(), r.getTitle(), r.getUrl(), r.getType(), r.isAffiliate(),
					r.getAffiliateMeta(), r.getDisplayOrder());
		}
	}

	public record CompetitionResponse(UUID id, String slug, String name, UUID organizerOrgId, String officialUrl,
			String logo, String description, String summary, UUID categoryId, List<String> tags,
			String participationMode, Short teamSizeMin, Short teamSizeMax, String delivery, String entryPathway,
			List<String> evaluationType, Short minGrade, Short maxGrade, Short minAge, Short maxAge,
			String costType, String recurrence, Map<String, Object> attributes, String provenanceSource,
			Instant provenanceLastVerifiedAt, BigDecimal provenanceConfidence, String verificationState,
			Instant archivedAt, Instant createdAt, Instant updatedAt, int version) {

		static CompetitionResponse from(Competition c) {
			Provenance p = c.getProvenance();
			return new CompetitionResponse(c.getId(), c.getSlug(), c.getName(),
					c.getOrganizer() != null ? c.getOrganizer().getId() : null, c.getOfficialUrl(), c.getLogo(),
					c.getDescription(), c.getSummary(), c.getCategory().getId(), c.getTags(),
					c.getParticipationMode().name(), c.getTeamSizeMin(), c.getTeamSizeMax(),
					c.getDelivery().name(), c.getEntryPathway().name(), c.getEvaluationType(), c.getMinGrade(),
					c.getMaxGrade(), c.getMinAge(), c.getMaxAge(), c.getCostType().name(),
					c.getRecurrence().name(), c.getAttributes(),
					p != null && p.getSource() != null ? p.getSource().name() : null,
					p != null ? p.getLastVerifiedAt() : null, p != null ? p.getConfidence() : null,
					c.getVerificationState().name(), c.getArchivedAt(), c.getCreatedAt(), c.getUpdatedAt(),
					c.getVersion());
		}
	}
}
