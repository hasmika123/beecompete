package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.Edition;
import com.beecompete.catalog.domain.EditionRegion;
import com.beecompete.catalog.domain.KeyDate;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.domain.Region;
import com.beecompete.catalog.repository.EditionRegionRepository;
import com.beecompete.catalog.repository.EditionRepository;
import com.beecompete.catalog.repository.KeyDateRepository;
import com.beecompete.catalog.repository.RegionRepository;
import java.time.Instant;
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
		Edition edition = editionCuration.create(competition.getId(), request.edition(), stamp);
		applyRegions(edition, request.regionIds());
		List<CompetitionWithEditionRequest.FirstEditionKeyDate> requestedDates = request.keyDates();
		if (requestedDates != null && !requestedDates.isEmpty()) {
			// Typed timeline rows (item 21); startsAt may be null (date TBD, R1-18).
			for (CompetitionWithEditionRequest.FirstEditionKeyDate row : requestedDates) {
				KeyDate keyDate = new KeyDate(edition, row.type(), row.startsAt());
				keyDate.setLabel(row.label());
				keyDate.setEndsAt(row.endsAt());
				keyDate.setTimezone(row.timezone());
				keyDates.save(keyDate);
			}
			editions.touchUpdatedAt(edition.getId(), Instant.now()); // sitemap lastmod (R1-10)
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
