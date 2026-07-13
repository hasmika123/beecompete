package com.beecompete.catalog.web;

import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.CompetitionFaq;
import com.beecompete.catalog.domain.CostType;
import com.beecompete.catalog.domain.Delivery;
import com.beecompete.catalog.domain.Edition;
import com.beecompete.catalog.domain.EntryPathway;
import com.beecompete.catalog.domain.EvaluationTypes;
import com.beecompete.catalog.domain.KeyDate;
import com.beecompete.catalog.domain.Organization;
import com.beecompete.catalog.domain.ParticipationMode;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.domain.Region;
import com.beecompete.catalog.domain.Resource;
import com.beecompete.catalog.repository.CompetitionFaqRepository;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.EditionRegionRepository;
import com.beecompete.catalog.repository.EditionRepository;
import com.beecompete.catalog.repository.KeyDateRepository;
import com.beecompete.catalog.repository.ResourceRepository;
import com.beecompete.catalog.service.CompetitionSearchService;
import com.beecompete.catalog.service.EffectiveStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * R1-4 public catalog read API (M5/M6, DQ1): paged competition list + full detail by slug,
 * with {@code verification_state} and provenance exposed (trust badges, DQ13). Archived
 * records are invisible here (D7). Edition status is rendered through {@link EffectiveStatus}
 * — the binding read-path rule — as {@code effectiveStatus} next to the curated token.
 *
 * <p>Enum values are exposed as lowercase public tokens (R1-1 as-built rule). The list endpoint
 * is also the R1-5 search & filter surface (M2/M3/M4) — see {@link CompetitionSearchService}
 * for the search/filter/facet semantics.
 */
@RestController
@RequestMapping("/api/v1")
@Transactional(readOnly = true)
public class CatalogPublicController {

	private final CompetitionRepository competitions;
	private final EditionRepository editions;
	private final KeyDateRepository keyDates;
	private final EditionRegionRepository editionRegions;
	private final ResourceRepository resources;
	private final CompetitionFaqRepository faqs;
	private final CompetitionSearchService search;

	public CatalogPublicController(CompetitionRepository competitions, EditionRepository editions,
			KeyDateRepository keyDates, EditionRegionRepository editionRegions, ResourceRepository resources,
			CompetitionFaqRepository faqs, CompetitionSearchService search) {
		this.competitions = competitions;
		this.editions = editions;
		this.keyDates = keyDates;
		this.editionRegions = editionRegions;
		this.resources = resources;
		this.faqs = faqs;
		this.search = search;
	}

	/**
	 * Browse + search + filter (R1-5). All params optional — no params is the plain R1-4 browse
	 * feed. Filter tokens are the lowercase public form; unknown tokens 400 (naming the allowed
	 * set), unknown filter VALUES (a category slug or region nobody has) return an empty page.
	 * {@code participation}/{@code pathway} are eligibility filters: "individual" includes
	 * records marked BOTH/EITHER. {@code sort=relevance} needs {@code q} (falls back to name).
	 */
	@GetMapping("/competitions")
	public SearchResponse list(@RequestParam(required = false) String q,
			@RequestParam(required = false) String category,
			@RequestParam(required = false) Short minGrade,
			@RequestParam(required = false) Short maxGrade,
			@RequestParam(required = false) String region,
			@RequestParam(required = false) String cost,
			@RequestParam(required = false) String delivery,
			@RequestParam(required = false) String participation,
			@RequestParam(required = false) String pathway,
			@RequestParam(required = false) List<String> evaluation,
			@RequestParam(required = false) Integer deadlineWithinDays,
			@RequestParam(required = false) String sort,
			@RequestParam(defaultValue = "false") boolean facets,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "25") int size) {
		if (evaluation != null) {
			for (String token : evaluation) {
				if (!EvaluationTypes.TOKENS.contains(token)) {
					throw badToken("evaluation", token, EvaluationTypes.TOKENS.stream().sorted().toList());
				}
			}
		}
		if (deadlineWithinDays != null && deadlineWithinDays < 0) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "deadlineWithinDays must be >= 0");
		}
		var criteria = new CompetitionSearchService.Criteria(q, category, minGrade, maxGrade, region,
				parseToken("cost", cost, CostType.class),
				parseToken("delivery", delivery, Delivery.class),
				parseEligibility("participation", participation, ParticipationMode.class,
						ParticipationMode.BOTH),
				parseEligibility("pathway", pathway, EntryPathway.class, EntryPathway.EITHER),
				evaluation,
				deadlineWithinDays,
				sort != null ? parseToken("sort", sort, CompetitionSearchService.SortOption.class)
						: (q != null && !q.isBlank() ? CompetitionSearchService.SortOption.RELEVANCE
								: CompetitionSearchService.SortOption.NAME),
				facets, Math.max(0, page), Math.clamp(size, 1, 100));
		CompetitionSearchService.Result result = search.search(criteria);
		return SearchResponse.from(result);
	}

	/** Regions with at least one live listing (filter options + Page-5 region tiles). */
	@GetMapping("/regions")
	public List<CompetitionSearchService.RegionOption> regions() {
		return search.regionOptions();
	}

	/** All categories with live counts (Page-5 tiles, hero category strip). */
	@GetMapping("/categories")
	public List<CompetitionSearchService.CategoryOption> categories() {
		return search.categoryOptions();
	}

	/**
	 * Sitemap feed (R1-10): every live competition's slug + category slug + last-modified stamp,
	 * so the web app's {@code sitemap.xml} can emit per-competition and per-category URLs with
	 * accurate {@code <lastmod>}. Lean projection (no entity hydration); the web route caches it.
	 */
	@GetMapping("/sitemap")
	public List<SitemapEntry> sitemap() {
		return competitions.findSitemapViews().stream()
				.map(v -> new SitemapEntry(v.getSlug(), v.getCategorySlug(), v.getUpdatedAt()))
				.toList();
	}

	private static <E extends Enum<E>> E parseToken(String param, String value, Class<E> type) {
		if (value == null || value.isBlank()) {
			return null;
		}
		try {
			return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
		} catch (IllegalArgumentException e) {
			throw badToken(param, value,
					java.util.Arrays.stream(type.getEnumConstants()).map(CatalogPublicController::token).toList());
		}
	}

	/** participation/pathway: the catch-all value (BOTH/EITHER) is not a filter choice — reject it. */
	private static <E extends Enum<E>> E parseEligibility(String param, String value, Class<E> type,
			E catchAll) {
		E parsed = parseToken(param, value, type);
		if (parsed == catchAll) {
			throw badToken(param, value, java.util.Arrays.stream(type.getEnumConstants())
					.filter(e -> e != catchAll).map(CatalogPublicController::token).toList());
		}
		return parsed;
	}

	private static ResponseStatusException badToken(String param, String value, List<String> allowed) {
		return new ResponseStatusException(HttpStatus.BAD_REQUEST,
				"unknown " + param + " '" + value + "' — allowed: " + String.join(", ", allowed));
	}

	@GetMapping("/competitions/{slug}")
	public CompetitionDetail get(@PathVariable String slug) {
		Competition competition = competitions.findBySlug(slug)
				.filter(c -> c.getArchivedAt() == null)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "competition not found"));
		Instant now = Instant.now();
		List<EditionView> editionViews = editions
				.findByCompetitionIdAndArchivedAtIsNullOrderByCreatedAt(competition.getId()).stream()
				.map(edition -> EditionView.from(edition,
						keyDates.findByEditionIdOrderByStartsAt(edition.getId()),
						editionRegions.findByEditionId(edition.getId()).stream()
								.map(er -> RegionView.from(er.getRegion()))
								.toList(),
						now))
				.toList();
		return CompetitionDetail.from(competition, editionViews,
				resources.findByCompetitionIdOrderByDisplayOrder(competition.getId()),
				faqs.findByCompetitionIdOrderByDisplayOrder(competition.getId()));
	}

	/** Lowercase public token for an enum (R1-1 as-built rule). */
	private static String token(Enum<?> value) {
		return value == null ? null : value.name().toLowerCase(Locale.ROOT);
	}

	// --- DTOs (public shapes — no version/audit columns, no affiliate meta) ---

	public record ProvenanceView(String source, Instant lastVerifiedAt, BigDecimal confidence) {
		static ProvenanceView from(Provenance p) {
			return p == null ? null
					: new ProvenanceView(token(p.getSource()), p.getLastVerifiedAt(), p.getConfidence());
		}
	}

	public record OrganizerView(String name, String type, String verificationState) {
		static OrganizerView from(Organization o) {
			return o == null ? null
					: new OrganizerView(o.getName(), token(o.getType()), token(o.getVerificationState()));
		}
	}

	public record CategoryView(String slug, String name) {}

	/** One row of the sitemap feed (R1-10) — enough to build a URL + its {@code <lastmod>}. */
	public record SitemapEntry(String slug, String categorySlug, Instant updatedAt) {}

	public record CompetitionSummary(UUID id, String slug, String name, String summary, String logo,
			CategoryView category, OrganizerView organizer, List<String> tags, String participationMode,
			Short teamSizeMin, Short teamSizeMax, String delivery, String entryPathway,
			List<String> evaluationType, Short minGrade, Short maxGrade, Short minAge, Short maxAge,
			String costType, String recurrence, String verificationState, ProvenanceView provenance,
			Instant nextDeadline, String prizeSummary, List<String> regions) {

		static CompetitionSummary from(CompetitionSearchService.Item item) {
			Competition c = item.competition();
			return new CompetitionSummary(c.getId(), c.getSlug(), c.getName(), c.getSummary(), c.getLogo(),
					new CategoryView(c.getCategory().getSlug(), c.getCategory().getName()),
					OrganizerView.from(c.getOrganizer()), c.getTags(), token(c.getParticipationMode()),
					c.getTeamSizeMin(), c.getTeamSizeMax(), token(c.getDelivery()), token(c.getEntryPathway()),
					c.getEvaluationType(), c.getMinGrade(), c.getMaxGrade(), c.getMinAge(), c.getMaxAge(),
					token(c.getCostType()), token(c.getRecurrence()), token(c.getVerificationState()),
					ProvenanceView.from(c.getProvenance()), item.nextDeadline(), item.prizeSummary(),
					item.regions());
		}
	}

	public record CategoryFacetView(String slug, String name, long count) {}

	public record GradeFacetView(short grade, long count) {}

	public record FacetsView(List<CategoryFacetView> categories, List<GradeFacetView> grades) {}

	/** Page-shaped response (content/totalElements/totalPages/number/size) + optional facet counts. */
	public record SearchResponse(List<CompetitionSummary> content, long totalElements, int totalPages,
			int number, int size, FacetsView facets) {

		static SearchResponse from(CompetitionSearchService.Result result) {
			List<CompetitionSummary> content = result.items().stream()
					.map(CompetitionSummary::from)
					.toList();
			FacetsView facets = result.facets() == null ? null
					: new FacetsView(
							result.facets().categories().stream()
									.map(f -> new CategoryFacetView(f.slug(), f.name(), f.count()))
									.toList(),
							result.facets().grades().stream()
									.map(f -> new GradeFacetView(f.grade(), f.count()))
									.toList());
			return new SearchResponse(content, result.total(),
					(int) Math.ceil((double) result.total() / result.size()), result.page(), result.size(),
					facets);
		}
	}

	public record KeyDateView(String type, String label, Instant startsAt, Instant endsAt, String timezone) {
		static KeyDateView from(KeyDate k) {
			return new KeyDateView(token(k.getType()), k.getLabel(), k.getStartsAt(), k.getEndsAt(),
					k.getTimezone());
		}
	}

	public record RegionView(String level, String name, String code) {
		static RegionView from(Region r) {
			return new RegionView(token(r.getLevel()), r.getName(), r.getCode());
		}
	}

	public record EditionView(UUID id, String cycleLabel, String status, String effectiveStatus,
			String scopeLevel, String registrationUrl, BigDecimal entryFee, String currency,
			LocalDate ageCutoffDate, String prizeSummary, BigDecimal prizeValue, String prizeCurrency,
			UUID advancesToEditionId, Map<String, Object> attributes, String verificationState,
			ProvenanceView provenance, List<KeyDateView> keyDates, List<RegionView> regions) {

		static EditionView from(Edition e, List<KeyDate> dates, List<RegionView> regions, Instant now) {
			return new EditionView(e.getId(), e.getCycleLabel(), token(e.getStatus()),
					token(EffectiveStatus.compute(e.getStatus(), dates, now)), token(e.getScopeLevel()),
					e.getRegistrationUrl(), e.getEntryFee(), e.getCurrency(), e.getAgeCutoffDate(),
					e.getPrizeSummary(), e.getPrizeValue(), e.getPrizeCurrency(),
					e.getAdvancesTo() != null ? e.getAdvancesTo().getId() : null, e.getAttributes(),
					token(e.getVerificationState()), ProvenanceView.from(e.getProvenance()),
					dates.stream().map(KeyDateView::from).toList(), regions);
		}
	}

	public record ResourceView(UUID id, String title, String url, String type, boolean isAffiliate,
			short displayOrder) {
		static ResourceView from(Resource r) {
			return new ResourceView(r.getId(), r.getTitle(), r.getUrl(), token(r.getType()), r.isAffiliate(),
					r.getDisplayOrder());
		}
	}

	public record FaqView(String question, String answer, short displayOrder) {
		static FaqView from(CompetitionFaq f) {
			return new FaqView(f.getQuestion(), f.getAnswer(), f.getDisplayOrder());
		}
	}

	public record CompetitionDetail(UUID id, String slug, String name, String summary, String description,
			String officialUrl, String logo, CategoryView category, OrganizerView organizer, List<String> tags,
			String participationMode, Short teamSizeMin, Short teamSizeMax, String delivery,
			String entryPathway, List<String> evaluationType, Short minGrade, Short maxGrade, Short minAge,
			Short maxAge, String costType, String recurrence, Map<String, Object> attributes,
			String verificationState, ProvenanceView provenance, List<EditionView> editions,
			List<ResourceView> resources, List<FaqView> faqs) {

		static CompetitionDetail from(Competition c, List<EditionView> editions, List<Resource> resources,
				List<CompetitionFaq> faqs) {
			return new CompetitionDetail(c.getId(), c.getSlug(), c.getName(), c.getSummary(),
					c.getDescription(), c.getOfficialUrl(), c.getLogo(),
					new CategoryView(c.getCategory().getSlug(), c.getCategory().getName()),
					OrganizerView.from(c.getOrganizer()), c.getTags(), token(c.getParticipationMode()),
					c.getTeamSizeMin(), c.getTeamSizeMax(), token(c.getDelivery()), token(c.getEntryPathway()),
					c.getEvaluationType(), c.getMinGrade(), c.getMaxGrade(), c.getMinAge(), c.getMaxAge(),
					token(c.getCostType()), token(c.getRecurrence()), c.getAttributes(),
					token(c.getVerificationState()), ProvenanceView.from(c.getProvenance()), editions,
					resources.stream().map(ResourceView::from).toList(),
					faqs.stream().map(FaqView::from).toList());
		}
	}
}
