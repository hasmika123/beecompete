package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.Edition;
import com.beecompete.catalog.domain.EditionStatus;
import com.beecompete.catalog.domain.EditionRegion;
import com.beecompete.catalog.domain.KeyDate;
import com.beecompete.catalog.domain.ListingStatus;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.domain.Region;
import com.beecompete.catalog.repository.EditionRegionRepository;
import com.beecompete.catalog.repository.EditionRepository;
import com.beecompete.catalog.repository.KeyDateRepository;
import com.beecompete.catalog.repository.RegionRepository;
import com.beecompete.catalog.service.EffectiveStatus;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Creates a competition together with its first edition (+ the edition's typed key dates + the
 * edition's regions) in ONE transaction (sweep Now-Opus). Atomicity is the point: a partial
 * create — competition saved but edition failed — is exactly the zombie listing the readiness
 * gate (domain-model §8a) hides. It composes the existing single-entity write paths, so every
 * competition/edition invariant (attributes-template validation, provenance stamp) still applies;
 * the inner {@code @Transactional} services join this outer transaction (propagation REQUIRED).
 */
@Service
public class ListingCurationService {

	private final CompetitionCurationService competitionCuration;
	private final EditionCurationService editionCuration;
	private final KeyDateRepository keyDates;
	private final EditionRepository editions;
	private final EditionRegionRepository editionRegions;
	private final RegionRepository regions;

	public ListingCurationService(CompetitionCurationService competitionCuration,
			EditionCurationService editionCuration, KeyDateRepository keyDates, EditionRepository editions,
			EditionRegionRepository editionRegions, RegionRepository regions) {
		this.competitionCuration = competitionCuration;
		this.editionCuration = editionCuration;
		this.keyDates = keyDates;
		this.editions = editions;
		this.editionRegions = editionRegions;
		this.regions = regions;
	}

	@Transactional
	public Competition createWithFirstEdition(CompetitionWithEditionRequest request, Provenance stamp) {
		Competition competition = competitionCuration.create(request.competition(), stamp);
		// Lifecycle (§8a): null → PUBLISHED, keeping the one-step create one step. First entry to
		// PUBLISHED stamps approved_at; approved_by stays null until RBAC (R2-7) — WHO is in the
		// admin write log. A DRAFT/IN_REVIEW create is invisible publicly until published.
		ListingStatus start = request.listingStatus() != null ? request.listingStatus() : ListingStatus.PUBLISHED;
		competition.setListingStatus(start);
		if (start == ListingStatus.PUBLISHED) {
			competition.setApprovedAt(Instant.now());
		}
		Edition edition = editionCuration.create(competition.getId(), request.edition(), stamp);
		applyRegions(edition, request.regionIds());
		List<CompetitionWithEditionRequest.FirstEditionKeyDate> requestedDates = request.keyDates();
		List<KeyDate> savedDates = new ArrayList<>();
		if (requestedDates != null && !requestedDates.isEmpty()) {
			// Typed timeline rows (item 21); startsAt may be null (date TBD, R1-18).
			for (CompetitionWithEditionRequest.FirstEditionKeyDate row : requestedDates) {
				KeyDate keyDate = new KeyDate(edition, row.type(), row.startsAt());
				keyDate.setLabel(row.label());
				keyDate.setEndsAt(row.endsAt());
				keyDate.setTimezone(row.timezone());
				savedDates.add(keyDates.save(keyDate));
			}
			editions.touchUpdatedAt(edition.getId(), Instant.now()); // sitemap lastmod (R1-10)
		}
		// No curated status (the create form stopped asking, 2026-08-22): seed the stored value
		// from the very rule the read path applies, so the admin list agrees with the public site
		// from the first render. A curated (non-null) status is stored as sent, as before.
		if (request.edition().status() == null) {
			edition.setStatus(EffectiveStatus.compute(EditionStatus.UPCOMING, savedDates, Instant.now()));
		}
		return competition;
	}

	/** Tag the edition with its regions (Edition-level join, Q3); unknown ids are a 422. */
	private void applyRegions(Edition edition, List<UUID> regionIds) {
		if (regionIds == null) {
			return;
		}
		regionIds.stream().distinct().forEach(regionId -> {
			Region region = regions.findById(regionId).orElseThrow(() -> new ResponseStatusException(
					HttpStatus.UNPROCESSABLE_ENTITY, "unknown region: " + regionId));
			editionRegions.save(new EditionRegion(edition, region));
		});
	}
}
