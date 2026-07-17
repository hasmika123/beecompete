package com.beecompete.catalog.web;

import com.beecompete.catalog.domain.HeroCard;
import com.beecompete.catalog.domain.LandingStat;
import com.beecompete.catalog.domain.ValuePropCard;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.FeaturedSlotRepository;
import com.beecompete.catalog.repository.HeroCardRepository;
import com.beecompete.catalog.repository.LandingStatRepository;
import com.beecompete.catalog.repository.ValuePropCardRepository;
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
	private final ValuePropCardRepository valuePropCards;
	private final LandingStatRepository landingStats;

	public LandingPublicController(HeroCardRepository heroCards, FeaturedSlotRepository featuredSlots,
			CompetitionRepository competitions, CompetitionSearchService search,
			ValuePropCardRepository valuePropCards, LandingStatRepository landingStats) {
		this.heroCards = heroCards;
		this.featuredSlots = featuredSlots;
		this.competitions = competitions;
		this.search = search;
		this.valuePropCards = valuePropCards;
		this.landingStats = landingStats;
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
		List<ValuePropCardView> valueProp = valuePropCards.findAll().stream()
				.sorted(Comparator.comparing(c -> c.getPosition().name()))
				.map(ValuePropCardView::from)
				.toList();
		List<StatView> stats = landingStats.findAll().stream()
				.sorted(Comparator.comparing(s -> s.getPosition().name()))
				.map(StatView::from)
				.toList();
		return new LandingView(cards, featured, competitions.countPublicListings(), valueProp, stats);
	}

	public record HeroCardView(String position, String imageKey, String altText, String linkUrl,
			String description) {
		static HeroCardView from(HeroCard h) {
			return new HeroCardView(h.getPosition().name().toLowerCase(Locale.ROOT), h.getImageKey(),
					h.getAltText(), h.getLinkUrl(), h.getDescription());
		}
	}

	public record ValuePropCardView(String position, String imageKey, String linkUrl, String label) {
		static ValuePropCardView from(ValuePropCard c) {
			return new ValuePropCardView(c.getPosition().name().toLowerCase(Locale.ROOT), c.getImageKey(),
					c.getLinkUrl(), c.getLabel());
		}
	}

	public record StatView(String position, String value, String label, String source) {
		static StatView from(LandingStat s) {
			return new StatView(s.getPosition().name().toLowerCase(Locale.ROOT), s.getValue(), s.getLabel(),
					s.getSource());
		}
	}

	public record LandingView(List<HeroCardView> heroCards,
			List<CatalogPublicController.CompetitionSummary> featured, long totalCompetitions,
			List<ValuePropCardView> valuePropCards, List<StatView> stats) {}
}
