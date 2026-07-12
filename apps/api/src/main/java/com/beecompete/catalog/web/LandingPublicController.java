package com.beecompete.catalog.web;

import com.beecompete.catalog.domain.HeroCard;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.FeaturedSlotRepository;
import com.beecompete.catalog.repository.HeroCardRepository;
import com.beecompete.catalog.service.CompetitionSearchService;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * R1-6b public landing content (M36): the admin-managed HeroCards + Featured carousel picks
 * (as full card items) + the live catalog count for the "N more competitions" label
 * (blueprints decision #7). Public, read-only, one call for the whole landing page.
 */
@RestController
@RequestMapping("/api/v1/landing")
@Transactional(readOnly = true)
public class LandingPublicController {

	private final HeroCardRepository heroCards;
	private final FeaturedSlotRepository featuredSlots;
	private final CompetitionRepository competitions;
	private final CompetitionSearchService search;

	public LandingPublicController(HeroCardRepository heroCards, FeaturedSlotRepository featuredSlots,
			CompetitionRepository competitions, CompetitionSearchService search) {
		this.heroCards = heroCards;
		this.featuredSlots = featuredSlots;
		this.competitions = competitions;
		this.search = search;
	}

	@GetMapping
	public LandingView get() {
		List<HeroCardView> cards = heroCards.findAll().stream()
				.sorted(Comparator.comparing(h -> h.getPosition().name()))
				.map(HeroCardView::from)
				.toList();
		List<UUID> featuredIds = featuredSlots.findAllByOrderByPosition().stream()
				.map(slot -> slot.getCompetition().getId())
				.toList();
		List<CatalogPublicController.CompetitionSummary> featured = search.itemsByIds(featuredIds).stream()
				.map(CatalogPublicController.CompetitionSummary::from)
				.toList();
		return new LandingView(cards, featured, competitions.countByArchivedAtIsNull());
	}

	public record HeroCardView(String position, String imageKey, String altText, String linkUrl,
			String description) {
		static HeroCardView from(HeroCard h) {
			return new HeroCardView(h.getPosition().name().toLowerCase(Locale.ROOT), h.getImageKey(),
					h.getAltText(), h.getLinkUrl(), h.getDescription());
		}
	}

	public record LandingView(List<HeroCardView> heroCards,
			List<CatalogPublicController.CompetitionSummary> featured, long totalCompetitions) {}
}
