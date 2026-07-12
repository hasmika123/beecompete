package com.beecompete.catalog.web;

import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.CompetitionFaq;
import com.beecompete.catalog.domain.Edition;
import com.beecompete.catalog.domain.KeyDate;
import com.beecompete.catalog.domain.Organization;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.domain.Region;
import com.beecompete.catalog.domain.Resource;
import com.beecompete.catalog.repository.CompetitionFaqRepository;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.EditionRegionRepository;
import com.beecompete.catalog.repository.EditionRepository;
import com.beecompete.catalog.repository.KeyDateRepository;
import com.beecompete.catalog.repository.ResourceRepository;
import com.beecompete.catalog.service.EffectiveStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
 * <p>Enum values are exposed as lowercase public tokens (R1-1 as-built rule). Search, filters,
 * and sort options land at R1-5; this list is the plain browse feed.
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

	public CatalogPublicController(CompetitionRepository competitions, EditionRepository editions,
			KeyDateRepository keyDates, EditionRegionRepository editionRegions, ResourceRepository resources,
			CompetitionFaqRepository faqs) {
		this.competitions = competitions;
		this.editions = editions;
		this.keyDates = keyDates;
		this.editionRegions = editionRegions;
		this.resources = resources;
		this.faqs = faqs;
	}

	@GetMapping("/competitions")
	public Page<CompetitionSummary> list(@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "25") int size) {
		var pageable = PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100), Sort.by("name"));
		return competitions.findByArchivedAtIsNull(pageable).map(CompetitionSummary::from);
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

	public record CompetitionSummary(UUID id, String slug, String name, String summary, String logo,
			CategoryView category, OrganizerView organizer, List<String> tags, String participationMode,
			Short teamSizeMin, Short teamSizeMax, String delivery, String entryPathway,
			List<String> evaluationType, Short minGrade, Short maxGrade, Short minAge, Short maxAge,
			String costType, String recurrence, String verificationState, ProvenanceView provenance) {

		static CompetitionSummary from(Competition c) {
			return new CompetitionSummary(c.getId(), c.getSlug(), c.getName(), c.getSummary(), c.getLogo(),
					new CategoryView(c.getCategory().getSlug(), c.getCategory().getName()),
					OrganizerView.from(c.getOrganizer()), c.getTags(), token(c.getParticipationMode()),
					c.getTeamSizeMin(), c.getTeamSizeMax(), token(c.getDelivery()), token(c.getEntryPathway()),
					c.getEvaluationType(), c.getMinGrade(), c.getMaxGrade(), c.getMinAge(), c.getMaxAge(),
					token(c.getCostType()), token(c.getRecurrence()), token(c.getVerificationState()),
					ProvenanceView.from(c.getProvenance()));
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
