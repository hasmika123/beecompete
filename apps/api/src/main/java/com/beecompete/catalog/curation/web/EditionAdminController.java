package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.curation.CurationStamps;
import com.beecompete.catalog.curation.EditionCurationService;
import com.beecompete.catalog.curation.EditionRequest;
import com.beecompete.catalog.domain.Edition;
import com.beecompete.catalog.domain.EditionRegion;
import com.beecompete.catalog.domain.KeyDate;
import com.beecompete.catalog.domain.KeyDateType;
import com.beecompete.catalog.domain.Region;
import com.beecompete.catalog.repository.EditionRegionRepository;
import com.beecompete.catalog.repository.EditionRepository;
import com.beecompete.catalog.repository.KeyDateRepository;
import com.beecompete.catalog.repository.RegionRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * R1-3 admin CRUD for Editions + their KeyDates and Region tags. Regions are set as a whole
 * list (Edition-level join, Q3). Delete = archive (D7); KeyDate child rows hard-delete.
 * See {@link CompetitionAdminController} for the controller-as-service-boundary note.
 */
@RestController
@RequestMapping("/api/v1/admin")
@Transactional
public class EditionAdminController {

	private final EditionRepository editions;
	private final EditionCurationService curation;
	private final KeyDateRepository keyDates;
	private final EditionRegionRepository editionRegions;
	private final RegionRepository regions;

	public EditionAdminController(EditionRepository editions, EditionCurationService curation,
			KeyDateRepository keyDates, EditionRegionRepository editionRegions, RegionRepository regions) {
		this.editions = editions;
		this.curation = curation;
		this.keyDates = keyDates;
		this.editionRegions = editionRegions;
		this.regions = regions;
	}

	@GetMapping("/competitions/{competitionId}/editions")
	@Transactional(readOnly = true)
	public List<EditionResponse> list(@PathVariable UUID competitionId) {
		return editions.findByCompetitionId(competitionId).stream().map(EditionResponse::from).toList();
	}

	@PostMapping("/competitions/{competitionId}/editions")
	@ResponseStatus(HttpStatus.CREATED)
	public EditionResponse create(@PathVariable UUID competitionId, @Valid @RequestBody EditionRequest request) {
		return EditionResponse.from(curation.create(competitionId, request, CurationStamps.curated()));
	}

	@GetMapping("/editions/{id}")
	@Transactional(readOnly = true)
	public EditionResponse get(@PathVariable UUID id) {
		return EditionResponse.from(require(id));
	}

	@PutMapping("/editions/{id}")
	public EditionResponse update(@PathVariable UUID id, @Valid @RequestBody EditionRequest request) {
		return EditionResponse.from(curation.update(id, request, CurationStamps.curated()));
	}

	@DeleteMapping("/editions/{id}")
	public EditionResponse archive(@PathVariable UUID id) {
		Edition edition = require(id);
		edition.setArchivedAt(Instant.now());
		return EditionResponse.from(edition);
	}

	@PostMapping("/editions/{id}/restore")
	public EditionResponse restore(@PathVariable UUID id) {
		Edition edition = require(id);
		edition.setArchivedAt(null);
		return EditionResponse.from(edition);
	}

	@PutMapping("/editions/{id}/verification")
	public EditionResponse setVerification(@PathVariable UUID id,
			@Valid @RequestBody CompetitionAdminController.VerificationRequest request) {
		Edition edition = require(id);
		edition.setVerificationState(request.state());
		return EditionResponse.from(edition);
	}

	// --- KeyDates (D3: timeline as data) ---

	@GetMapping("/editions/{id}/key-dates")
	@Transactional(readOnly = true)
	public List<KeyDateResponse> listKeyDates(@PathVariable UUID id) {
		return keyDates.findByEditionIdOrderByStartsAt(id).stream().map(KeyDateResponse::from).toList();
	}

	@PostMapping("/editions/{id}/key-dates")
	@ResponseStatus(HttpStatus.CREATED)
	public KeyDateResponse createKeyDate(@PathVariable UUID id, @Valid @RequestBody KeyDateRequest request) {
		Edition edition = require(id);
		KeyDate keyDate = new KeyDate(edition, request.type(), request.startsAt());
		applyKeyDate(keyDate, request);
		KeyDateResponse saved = KeyDateResponse.from(keyDates.save(keyDate));
		editions.touchUpdatedAt(edition.getId(), Instant.now()); // sitemap lastmod (R1-10)
		return saved;
	}

	@PutMapping("/key-dates/{keyDateId}")
	public KeyDateResponse updateKeyDate(@PathVariable UUID keyDateId, @Valid @RequestBody KeyDateRequest request) {
		KeyDate keyDate = keyDates.findById(keyDateId).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "key date not found"));
		keyDate.setType(request.type());
		keyDate.setStartsAt(request.startsAt());
		applyKeyDate(keyDate, request);
		editions.touchUpdatedAt(keyDate.getEdition().getId(), Instant.now()); // sitemap lastmod (R1-10)
		return KeyDateResponse.from(keyDate);
	}

	@DeleteMapping("/key-dates/{keyDateId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteKeyDate(@PathVariable UUID keyDateId) {
		UUID editionId = keyDates.findById(keyDateId).map(kd -> kd.getEdition().getId()).orElse(null);
		keyDates.deleteById(keyDateId);
		if (editionId != null) {
			editions.touchUpdatedAt(editionId, Instant.now()); // sitemap lastmod (R1-10)
		}
	}

	// --- Region tags (Q3: the join is Edition-level; set as a whole list) ---

	@PutMapping("/editions/{id}/regions")
	public List<UUID> setRegions(@PathVariable UUID id, @Valid @RequestBody RegionsRequest request) {
		Edition edition = require(id);
		editionRegions.deleteAll(editionRegions.findByEditionId(id));
		// Flush the deletes NOW — Hibernate otherwise orders inserts before deletes in the
		// final flush, and re-tagging an already-tagged region would violate the composite PK.
		editionRegions.flush();
		List<UUID> applied = request.regionIds().stream().distinct().map(regionId -> {
			Region region = regions.findById(regionId).orElseThrow(() -> new ResponseStatusException(
					HttpStatus.UNPROCESSABLE_ENTITY, "unknown region: " + regionId));
			return editionRegions.save(new EditionRegion(edition, region)).getRegion().getId();
		}).toList();
		return applied;
	}

	@GetMapping("/editions/{id}/regions")
	@Transactional(readOnly = true)
	public List<UUID> getRegions(@PathVariable UUID id) {
		return editionRegions.findByEditionId(id).stream().map(er -> er.getRegion().getId()).toList();
	}

	private void applyKeyDate(KeyDate keyDate, KeyDateRequest request) {
		keyDate.setLabel(request.label());
		keyDate.setEndsAt(request.endsAt());
		keyDate.setTimezone(request.timezone());
	}

	private Edition require(UUID id) {
		return editions.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "edition not found"));
	}

	// --- DTOs (EditionRequest lives in catalog.curation — shared with the correction queue) ---

	public record KeyDateRequest(@NotNull KeyDateType type, @Size(max = 200) String label,
			@NotNull Instant startsAt, Instant endsAt, @Size(max = 60) String timezone) {

		@AssertTrue(message = "endsAt must be after startsAt")
		public boolean isEndAfterStart() {
			return endsAt == null || (startsAt != null && endsAt.isAfter(startsAt));
		}
	}

	public record KeyDateResponse(UUID id, KeyDateType type, String label, Instant startsAt, Instant endsAt,
			String timezone) {
		static KeyDateResponse from(KeyDate k) {
			return new KeyDateResponse(k.getId(), k.getType(), k.getLabel(), k.getStartsAt(), k.getEndsAt(),
					k.getTimezone());
		}
	}

	public record RegionsRequest(@NotNull List<UUID> regionIds) {}

	public record EditionResponse(UUID id, UUID competitionId, String cycleLabel, String status,
			String registrationUrl, BigDecimal entryFee, String currency, LocalDate ageCutoffDate,
			String prizeSummary, BigDecimal prizeValue, String prizeCurrency, String scopeLevel,
			UUID advancesToEditionId, Map<String, Object> attributes, String verificationState,
			Instant archivedAt, Instant createdAt, Instant updatedAt, int version) {

		static EditionResponse from(Edition e) {
			return new EditionResponse(e.getId(), e.getCompetition().getId(), e.getCycleLabel(),
					e.getStatus().name(), e.getRegistrationUrl(), e.getEntryFee(), e.getCurrency(),
					e.getAgeCutoffDate(), e.getPrizeSummary(), e.getPrizeValue(), e.getPrizeCurrency(),
					e.getScopeLevel().name(), e.getAdvancesTo() != null ? e.getAdvancesTo().getId() : null,
					e.getAttributes(), e.getVerificationState().name(), e.getArchivedAt(), e.getCreatedAt(),
					e.getUpdatedAt(), e.getVersion());
		}
	}
}
