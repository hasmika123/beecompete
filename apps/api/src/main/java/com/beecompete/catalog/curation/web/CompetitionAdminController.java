package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.curation.CompetitionCurationService;
import com.beecompete.catalog.curation.CompetitionRequest;
import com.beecompete.catalog.curation.CompetitionWithEditionRequest;
import com.beecompete.catalog.curation.CurationStamps;
import com.beecompete.catalog.curation.DuplicateDetectionService;
import com.beecompete.catalog.curation.FaqRequest;
import com.beecompete.catalog.curation.ListingCurationService;
import com.beecompete.catalog.curation.ResourceCurationService;
import com.beecompete.catalog.curation.ResourceRequest;
import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.ListingStatus;
import com.beecompete.catalog.domain.CompetitionFaq;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.domain.Resource;
import com.beecompete.catalog.domain.ResourceType;
import com.beecompete.catalog.domain.VerificationState;
import com.beecompete.catalog.repository.CompetitionFaqRepository;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.FeaturedSlotRepository;
import com.beecompete.catalog.repository.ResourceRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
	private final FeaturedSlotRepository featuredSlots;
	private final CompetitionCurationService curation;
	private final ListingCurationService listingCuration;
	private final ResourceCurationService resourceCuration;
	private final DuplicateDetectionService duplicateDetection;

	public CompetitionAdminController(CompetitionRepository competitions, CompetitionFaqRepository faqs,
			ResourceRepository resources, FeaturedSlotRepository featuredSlots,
			CompetitionCurationService curation, ListingCurationService listingCuration,
			ResourceCurationService resourceCuration, DuplicateDetectionService duplicateDetection) {
		this.competitions = competitions;
		this.faqs = faqs;
		this.resources = resources;
		this.featuredSlots = featuredSlots;
		this.curation = curation;
		this.listingCuration = listingCuration;
		this.resourceCuration = resourceCuration;
		this.duplicateDetection = duplicateDetection;
	}

	/**
	 * Admin list. {@code missingEdition=true} narrows to ZOMBIE listings — no live edition, so the
	 * readiness gate hides them publicly (domain-model &sect;8a). They can only arrive via import
	 * approve, which is deliberately lenient (see ImportReviewService); the create form posts
	 * {@code /competitions/with-edition} and cannot make one. Surfacing them here is how that debt
	 * gets found and finished instead of accumulating invisibly.
	 *
	 * <p>Every row carries {@code hasLiveEdition} for the badge, resolved in ONE extra query per
	 * page rather than one per row.
	 */
	@GetMapping("/competitions")
	@Transactional(readOnly = true)
	public Page<CompetitionResponse> list(@RequestParam(defaultValue = "") String query,
			@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size,
			@RequestParam(defaultValue = "false") boolean missingEdition,
			@RequestParam(required = false) ListingStatus listingStatus) {
		var pageable = PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100), Sort.by("name"));
		Page<Competition> found = listingStatus != null
				? competitions.findByListingStatusAndNameContainingIgnoreCaseAndArchivedAtIsNull(
						listingStatus, query, pageable)
				: missingEdition
						? competitions.findMissingLiveEdition(query, pageable)
						: competitions.findByNameContainingIgnoreCase(query, pageable);
		List<UUID> ids = found.getContent().stream().map(Competition::getId).toList();
		Set<UUID> live = ids.isEmpty() ? Set.of() : Set.copyOf(competitions.idsWithLiveEdition(ids));
		return found.map(c -> CompetitionResponse.from(c, live.contains(c.getId())));
	}

	/**
	 * Duplicate candidates for a listing about to be saved (DQ4) — what the write gate would refuse,
	 * asked BEFORE submit so the form can show the candidates and offer "not a duplicate" instead
	 * of a 409/422 after the fact. Same detection the gate runs; {@code excludeId} on edit.
	 */
	@GetMapping("/competitions/duplicates")
	@Transactional(readOnly = true)
	public DuplicateDetectionService.CompetitionDuplicates duplicates(
			@RequestParam(required = false) String name, @RequestParam(required = false) String officialUrl,
			@RequestParam(required = false) String slug, @RequestParam(required = false) UUID excludeId,
			@RequestParam(required = false) UUID excludeImportRecordId) {
		return duplicateDetection.findCompetition(name, officialUrl, slug, excludeId, excludeImportRecordId);
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

	/**
	 * Combined create (sweep Now-Opus): competition shell + its first edition (+ optional headline
	 * REG_CLOSE date) in one transaction, so admin listings are complete-by-default and never land
	 * as a zombie (competition with no edition). Future editions use {@code POST
	 * /competitions/{id}/editions}.
	 */
	@PostMapping("/competitions/with-edition")
	@ResponseStatus(HttpStatus.CREATED)
	public CompetitionResponse createWithEdition(@Valid @RequestBody CompetitionWithEditionRequest request) {
		return CompetitionResponse.from(
				listingCuration.createWithFirstEdition(request, CurationStamps.curated()));
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
		// An archived listing must not linger in the landing carousel (no archived+featured).
		featuredSlots.deleteByCompetitionId(id);
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

	/**
	 * §8a lifecycle: Publish / Unlist / Re-list / Submit-for-review / Send-back, as one explicit
	 * transition (validated in {@link CompetitionCurationService#transitionListingStatus}).
	 * Archive stays the separate DELETE — orthogonal axis.
	 */
	@PutMapping("/competitions/{id}/listing-status")
	public CompetitionResponse setListingStatus(@PathVariable UUID id,
			@Valid @RequestBody ListingStatusRequest request) {
		return CompetitionResponse.from(curation.transitionListingStatus(id, request.status()));
	}

	public record ListingStatusRequest(@jakarta.validation.constraints.NotNull ListingStatus status) {}

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
		return ResourceResponse.from(resourceCuration.create(id, request));
	}

	@PutMapping("/resources/{resourceId}")
	public ResourceResponse updateResource(@PathVariable UUID resourceId, @Valid @RequestBody ResourceRequest request) {
		return ResourceResponse.from(resourceCuration.update(resourceId, request));
	}

	@DeleteMapping("/resources/{resourceId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteResource(@PathVariable UUID resourceId) {
		resources.deleteById(resourceId);
	}

	private Competition require(UUID id) {
		return competitions.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "competition not found"));
	}

	// --- DTOs ---

	public record VerificationRequest(@NotNull VerificationState state) {}

	public record FaqResponse(UUID id, String question, String answer, short displayOrder) {
		static FaqResponse from(CompetitionFaq faq) {
			return new FaqResponse(faq.getId(), faq.getQuestion(), faq.getAnswer(), faq.getDisplayOrder());
		}
	}

	/** ResourceRequest lives in catalog.curation — shared with the correction queue (R1-3b). */
	public record ResourceResponse(UUID id, String title, String url, ResourceType type, boolean isAffiliate,
			Map<String, Object> affiliateMeta, short displayOrder, String imageUrl) {
		static ResourceResponse from(Resource r) {
			return new ResourceResponse(r.getId(), r.getTitle(), r.getUrl(), r.getType(), r.isAffiliate(),
					r.getAffiliateMeta(), r.getDisplayOrder(), r.getImageUrl());
		}
	}

	public record CompetitionResponse(UUID id, String slug, String name, UUID organizerOrgId, String officialUrl,
			String logo, String description, UUID categoryId, List<String> tags,
			String participationMode, Short teamSizeMin, Short teamSizeMax, String delivery, List<String> entryPathways,
			List<String> evaluationType, String eligibilityBasis, Short minGrade, Short maxGrade,
			Short minAge, Short maxAge,
			String costType, String recurrence, Map<String, Object> attributes, String provenanceSource,
			Instant provenanceLastVerifiedAt, BigDecimal provenanceConfidence, String verificationState,
			String listingStatus, Instant approvedAt,
			Instant archivedAt, Instant createdAt, Instant updatedAt, int version,
			/**
			 * Whether a non-archived edition exists — the readiness gate, precomputed for the admin
			 * list's badge. NULL on every other endpoint, meaning "not computed", never "no edition":
			 * only the list pays for the lookup.
			 */
			Boolean hasLiveEdition) {

		static CompetitionResponse from(Competition c) {
			return from(c, null);
		}

		static CompetitionResponse from(Competition c, Boolean hasLiveEdition) {
			Provenance p = c.getProvenance();
			return new CompetitionResponse(c.getId(), c.getSlug(), c.getName(),
					c.getOrganizer() != null ? c.getOrganizer().getId() : null, c.getOfficialUrl(), c.getLogo(),
					c.getDescription(), c.getCategory().getId(), c.getTags(),
					c.getParticipationMode().name(), c.getTeamSizeMin(), c.getTeamSizeMax(),
					c.getDelivery().name(), c.getEntryPathways(), c.getEvaluationType(),
					c.getEligibilityBasis() != null ? c.getEligibilityBasis().name() : null, c.getMinGrade(),
					c.getMaxGrade(), c.getMinAge(), c.getMaxAge(), c.getCostType().name(),
					c.getRecurrence().name(), c.getAttributes(),
					p != null && p.getSource() != null ? p.getSource().name() : null,
					p != null ? p.getLastVerifiedAt() : null, p != null ? p.getConfidence() : null,
					c.getVerificationState().name(), c.getListingStatus().name(), c.getApprovedAt(),
					c.getArchivedAt(), c.getCreatedAt(), c.getUpdatedAt(),
					c.getVersion(), hasLiveEdition);
		}
	}
}
