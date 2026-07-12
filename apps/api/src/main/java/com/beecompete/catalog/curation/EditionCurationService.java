package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.Edition;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.EditionRepository;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Applies an {@link EditionRequest} to an Edition — the single write path used by the admin
 * CRUD controller AND the correction-queue approve (R1-3b). Every write stamps provenance
 * (R1-3 rule). The attributes bag is intentionally NOT schema-validated at R1 — Category
 * Templates validate the COMPETITION's attributes (domain-model §3a); no edition-level
 * template exists.
 */
@Service
public class EditionCurationService {

	private final EditionRepository editions;
	private final CompetitionRepository competitions;

	public EditionCurationService(EditionRepository editions, CompetitionRepository competitions) {
		this.editions = editions;
		this.competitions = competitions;
	}

	@Transactional
	public Edition create(UUID competitionId, EditionRequest request, Provenance stamp) {
		Competition competition = competitions.findById(competitionId).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "competition not found"));
		Edition edition = new Edition(competition, request.cycleLabel(), request.status(), request.scopeLevel());
		apply(edition, request, stamp);
		return editions.save(edition);
	}

	@Transactional
	public Edition update(UUID id, EditionRequest request, Provenance stamp) {
		Edition edition = editions.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "edition not found"));
		edition.setCycleLabel(request.cycleLabel());
		edition.setStatus(request.status());
		edition.setScopeLevel(request.scopeLevel());
		apply(edition, request, stamp);
		return edition;
	}

	private void apply(Edition edition, EditionRequest request, Provenance stamp) {
		edition.setRegistrationUrl(request.registrationUrl());
		edition.setEntryFee(request.entryFee());
		edition.setCurrency(request.currency());
		edition.setAgeCutoffDate(request.ageCutoffDate());
		edition.setPrizeSummary(request.prizeSummary());
		edition.setPrizeValue(request.prizeValue());
		edition.setPrizeCurrency(request.prizeCurrency());
		edition.setAttributes(request.attributes());
		edition.setProvenance(stamp);
		if (request.advancesToEditionId() != null) {
			edition.setAdvancesTo(editions.findById(request.advancesToEditionId()).orElseThrow(
					() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "unknown advances-to edition")));
		} else {
			edition.setAdvancesTo(null);
		}
	}
}
