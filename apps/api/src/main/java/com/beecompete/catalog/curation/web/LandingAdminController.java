package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.FeaturedSlot;
import com.beecompete.catalog.domain.HeroCard;
import com.beecompete.catalog.domain.HeroCardPosition;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.FeaturedSlotRepository;
import com.beecompete.catalog.repository.HeroCardRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * R1-3 landing-content panel (M36): the 3 admin-managed HeroCards (upsert per position — exactly
 * one active row each) and the FeaturedSlot carousel (replace-the-list, ordered, ≤10 per the
 * blueprint's 6–10 cap). Image upload (S3 pre-signed) lands in PR C — until then imageKey is the
 * S3 object key set directly.
 */
@RestController
@RequestMapping("/api/v1/admin")
@Transactional
public class LandingAdminController {

	private static final int FEATURED_MAX = 10;

	private final HeroCardRepository heroCards;
	private final FeaturedSlotRepository featuredSlots;
	private final CompetitionRepository competitions;

	public LandingAdminController(HeroCardRepository heroCards, FeaturedSlotRepository featuredSlots,
			CompetitionRepository competitions) {
		this.heroCards = heroCards;
		this.featuredSlots = featuredSlots;
		this.competitions = competitions;
	}

	@GetMapping("/hero-cards")
	@Transactional(readOnly = true)
	public List<HeroCardResponse> listHeroCards() {
		return heroCards.findAll().stream().map(HeroCardResponse::from).toList();
	}

	/** Upsert by position — the unique constraint guarantees one active row per slot. */
	@PutMapping("/hero-cards/{position}")
	public HeroCardResponse putHeroCard(@PathVariable HeroCardPosition position,
			@Valid @RequestBody HeroCardRequest request) {
		HeroCard card = heroCards.findByPosition(position)
				.orElseGet(() -> new HeroCard(position, request.imageKey(), request.altText()));
		card.setImageKey(request.imageKey());
		card.setAltText(request.altText());
		card.setLinkUrl(request.linkUrl());
		card.setDescription(request.description());
		return HeroCardResponse.from(heroCards.save(card));
	}

	@GetMapping("/featured-slots")
	@Transactional(readOnly = true)
	public List<FeaturedSlotResponse> listFeaturedSlots() {
		return featuredSlots.findAllByOrderByPosition().stream().map(FeaturedSlotResponse::from).toList();
	}

	/** Replace the whole ordered list (positions 1..n). Blueprint cap: 6–10 shown, 10 max stored. */
	@PutMapping("/featured-slots")
	public List<FeaturedSlotResponse> putFeaturedSlots(@Valid @RequestBody FeaturedSlotsRequest request) {
		List<UUID> ids = request.competitionIds().stream().distinct().toList();
		if (ids.size() > FEATURED_MAX) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"at most " + FEATURED_MAX + " featured slots");
		}
		featuredSlots.deleteAll();
		featuredSlots.flush(); // deletes must hit the DB before re-inserting the same competitions
		short position = 1;
		for (UUID id : ids) {
			Competition competition = competitions.findById(id).orElseThrow(() -> new ResponseStatusException(
					HttpStatus.UNPROCESSABLE_ENTITY, "unknown competition: " + id));
			if (competition.getArchivedAt() != null) {
				throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
						"cannot feature an archived competition: " + id);
			}
			featuredSlots.save(new FeaturedSlot(competition, position++));
		}
		return featuredSlots.findAllByOrderByPosition().stream().map(FeaturedSlotResponse::from).toList();
	}

	public record HeroCardRequest(@NotBlank @Size(max = 500) String imageKey,
			@NotBlank @Size(max = 300) String altText, @Size(max = 1000) String linkUrl,
			@Size(max = 500) String description) {}

	public record HeroCardResponse(UUID id, String position, String imageKey, String altText, String linkUrl,
			String description, Instant updatedAt) {
		static HeroCardResponse from(HeroCard h) {
			return new HeroCardResponse(h.getId(), h.getPosition().name(), h.getImageKey(), h.getAltText(),
					h.getLinkUrl(), h.getDescription(), h.getUpdatedAt());
		}
	}

	public record FeaturedSlotsRequest(@NotEmpty List<UUID> competitionIds) {}

	public record FeaturedSlotResponse(UUID id, UUID competitionId, short position) {
		static FeaturedSlotResponse from(FeaturedSlot f) {
			return new FeaturedSlotResponse(f.getId(), f.getCompetition().getId(), f.getPosition());
		}
	}
}
