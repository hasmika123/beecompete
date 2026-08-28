package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.CompetitionFaq;
import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.domain.ImportStatus;
import com.beecompete.catalog.domain.ListingStatus;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.repository.CompetitionFaqRepository;
import com.beecompete.catalog.repository.ImportRecordRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import com.beecompete.platform.web.CuratorAuditFilter;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * The decision half of the R1-3 import queue: approving a queued extraction into a real listing, or
 * rejecting it.
 *
 * <p><b>Why this is a service and not controller code.</b> Bulk review runs the same decision over
 * many records, and one unapprovable row must not roll back the rows either side of it. Each method
 * therefore runs in its OWN transaction ({@link Propagation#REQUIRES_NEW}), which only works across
 * a bean boundary — a self-call inside the controller would silently share one transaction and take
 * the whole batch down with the first failure.
 */
@Service
public class ImportReviewService {

	/** Payload keys the S3 pipeline (and the admin review form) may add alongside the competition fields. */
	private static final String EDITION_KEY = "edition";
	private static final String KEY_DATES_KEY = "keyDates";
	private static final String REGION_IDS_KEY = "regionIds";
	/** Prep-resource rows the S3 extractor suggests (2026-08-28) — sub-resources of the created row. */
	private static final String RESOURCES_KEY = "resources";
	/** FAQ rows the S3 extractor suggests (2026-08-28) — also sub-resources, same lifecycle. */
	private static final String FAQS_KEY = "faqs";

	private final ImportRecordRepository importRecords;
	private final CompetitionCurationService curation;
	private final ListingCurationService listingCuration;
	private final ResourceCurationService resourceCuration;
	private final CompetitionFaqRepository competitionFaqs;
	private final ObjectMapper mapper;
	private final Validator validator;

	public ImportReviewService(ImportRecordRepository importRecords, CompetitionCurationService curation,
			ListingCurationService listingCuration, ResourceCurationService resourceCuration,
			CompetitionFaqRepository competitionFaqs, ObjectMapper mapper, Validator validator) {
		this.importRecords = importRecords;
		this.curation = curation;
		this.listingCuration = listingCuration;
		this.resourceCuration = resourceCuration;
		this.competitionFaqs = competitionFaqs;
		this.mapper = mapper;
		this.validator = validator;
	}

	/**
	 * Approve: creates the Competition — plus its FIRST edition, typed key dates and edition regions
	 * when the payload carries them (S3 v1). An optional override replaces the stored payload: the
	 * curator's "edit then approve" path, which the admin review FORM uses for every approval (it
	 * posts the edited form back as a payload). Validation (Bean Validation + category-template
	 * attributes) happens HERE, not at ingress — garbage may enter the queue, only reviewed data
	 * leaves it.
	 *
	 * <p><b>Why the edition belongs on approve.</b> Creating the competition alone leaves exactly the
	 * "zombie listing" (competition with no edition) that the readiness gate hides (domain-model
	 * &sect;8a) — tolerable one at a time, a catalog-wide problem when seeding hundreds. Carrying the
	 * edition through lets one approve produce a complete listing, atomically, via
	 * {@link ListingCurationService}.
	 *
	 * <p><b>Deliberately lenient — read before adding validation.</b> We assemble a
	 * {@link CompetitionWithEditionRequest} to reuse that atomic create, but validate its PARTS and
	 * never the wrapper. The wrapper's {@code @AssertTrue} rules encode the ADMIN CREATE FORM's
	 * completeness policy (organizer, description, prize, region, registration URL ...); applying them
	 * here would make most extracted rows unapprovable, since a competition's own page routinely
	 * states no prize or fee. That split is the existing design intent — see the class note on
	 * {@link CompetitionWithEditionRequest}. The review form mirrors it: it SHOWS what is missing,
	 * and still lets the curator approve. Validating the wrapper here would silently break seeding.
	 */
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public ImportRecord approve(UUID id, Map<String, Object> payloadOverride) {
		ImportRecord record = requirePending(id);
		Map<String, Object> payload = payloadOverride != null ? payloadOverride : record.getPayload();

		// Split the seeding extras OUT before mapping the competition half. Unknown properties are
		// ignored by default, so leaving them in would work only by luck; removing them keeps the
		// competition mapping honest.
		Map<String, Object> competitionPayload = new LinkedHashMap<>(payload);
		Object editionNode = competitionPayload.remove(EDITION_KEY);
		Object keyDatesNode = competitionPayload.remove(KEY_DATES_KEY);
		Object regionIdsNode = competitionPayload.remove(REGION_IDS_KEY);
		Object resourcesNode = competitionPayload.remove(RESOURCES_KEY);
		Object faqsNode = competitionPayload.remove(FAQS_KEY);

		CompetitionRequest request = convertOrThrow(competitionPayload, CompetitionRequest.class, "competition");
		validateOrThrow(request, "payload invalid");

		Provenance stamp = CurationStamps.imported(record.getConfidence());
		Competition created;
		if (editionNode == null) {
			// Key dates and regions hang off an edition; without one there is nothing to attach them
			// to. Fail loudly rather than dropping data a curator believed they were approving.
			if (keyDatesNode != null) {
				throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
						"keyDates present without an edition - key dates belong to an edition");
			}
			if (regionIdsNode != null) {
				throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
						"regionIds present without an edition - regions are tagged on an edition");
			}
			created = curation.create(request, stamp);
		} else {
			EditionRequest edition = convertOrThrow(editionNode, EditionRequest.class, "edition");
			validateOrThrow(edition, "edition invalid");
			List<CompetitionWithEditionRequest.FirstEditionKeyDate> dates = convertKeyDates(keyDatesNode);
			dates.forEach(d -> validateOrThrow(d, "key date invalid"));
			created = listingCuration.createWithFirstEdition(
					// PUBLISHED explicitly: approving from the queue IS the review (§8a) — a second
					// approval step for the same record would be the owner reviewing twice.
					new CompetitionWithEditionRequest(request, edition, dates, convertRegionIds(regionIdsNode),
							ListingStatus.PUBLISHED),
					stamp);
		}

		// Prep resources are SUB-resources: they need the competition's id, so they are created after
		// it, not inside the atomic create. This runs in the approve transaction, so an invalid row
		// rolls the whole approval back rather than leaving a listing missing links a curator
		// believed they were approving — the same "fail loudly" stance as keyDates without an edition.
		createResources(resourcesNode, created);
		createFaqs(faqsNode, created);

		record.setPayload(payload);
		record.setStatus(ImportStatus.APPROVED);
		record.setReviewedAt(Instant.now());
		record.setNote(attribute("created competition " + created.getId()));
		return record;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public ImportRecord reject(UUID id, String note) {
		ImportRecord record = requirePending(id);
		record.setStatus(ImportStatus.REJECTED);
		record.setReviewedAt(Instant.now());
		record.setNote(attribute(note));
		return record;
	}

	/**
	 * Append WHO reviewed this to the queue note. The queue is the one place a curator needs to
	 * see another curator's decision in the UI ("did someone already look at this?"), and
	 * {@code reviewed_by} cannot hold it — it is a UUID reserved for a real user id at R2-7. When
	 * that lands, {@code reviewed_by} becomes the record and this suffix stops being written; the
	 * historical notes stay readable either way. Unattributed (a script, local dev) appends
	 * nothing rather than "by null".
	 */
	private static String attribute(String note) {
		String curator = CuratorAuditFilter.current();
		if (curator == null) {
			return note;
		}
		return (note == null || note.isBlank()) ? "reviewed by " + curator : note + " · by " + curator;
	}

	/**
	 * Suggested prep links → Resource rows. `displayOrder` is assigned from position rather than
	 * trusted from the payload: the extractor emits an ordered list, and a duplicated or missing
	 * order value would otherwise decide how the public Prep resources row reads.
	 */
	private void createResources(Object node, Competition competition) {
		if (node == null) {
			return;
		}
		List<ResourceRequest> requests;
		try {
			requests = mapper.convertValue(node, new TypeReference<List<ResourceRequest>>() {});
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"resources invalid: " + e.getMessage());
		}
		for (int i = 0; i < requests.size(); i++) {
			ResourceRequest row = requests.get(i);
			validateOrThrow(row, "resource invalid");
			resourceCuration.create(competition.getId(),
					new ResourceRequest(row.title(), row.url(), row.type(), row.isAffiliate(),
							row.affiliateMeta(), (short) i, row.imageUrl()));
		}
	}

	/**
	 * Suggested FAQ entries → CompetitionFaq rows. Same shape and same reasoning as
	 * {@link #createResources}: sub-resources of the competition, created inside the approve
	 * transaction, with {@code displayOrder} taken from position rather than trusted from the
	 * payload — order decides how the public FAQ tab reads.
	 */
	private void createFaqs(Object node, Competition competition) {
		if (node == null) {
			return;
		}
		List<FaqRequest> requests;
		try {
			requests = mapper.convertValue(node, new TypeReference<List<FaqRequest>>() {});
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "faqs invalid: " + e.getMessage());
		}
		for (int i = 0; i < requests.size(); i++) {
			FaqRequest row = requests.get(i);
			validateOrThrow(row, "faq invalid");
			competitionFaqs.save(new CompetitionFaq(competition, row.question(), row.answer(), (short) i));
		}
	}

	private List<CompetitionWithEditionRequest.FirstEditionKeyDate> convertKeyDates(Object node) {
		if (node == null) {
			return List.of();
		}
		try {
			return mapper.convertValue(node,
					new TypeReference<List<CompetitionWithEditionRequest.FirstEditionKeyDate>>() {});
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"keyDates do not parse: " + e.getMessage());
		}
	}

	/** null (not an empty list) when the payload names no regions — {@code applyRegions} skips on null. */
	private List<UUID> convertRegionIds(Object node) {
		if (node == null) {
			return null;
		}
		try {
			return mapper.convertValue(node, new TypeReference<List<UUID>>() {});
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"regionIds do not parse: " + e.getMessage());
		}
	}

	private <T> T convertOrThrow(Object node, Class<T> type, String what) {
		try {
			return mapper.convertValue(node, type);
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"payload does not parse as a " + what + ": " + e.getMessage());
		}
	}

	private <T> void validateOrThrow(T target, String prefix) {
		Set<ConstraintViolation<T>> violations = validator.validate(target);
		if (!violations.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, prefix + ": " + violations
					.stream()
					.map(v -> v.getPropertyPath() + " " + v.getMessage())
					.collect(Collectors.joining("; ")));
		}
	}

	private ImportRecord requirePending(UUID id) {
		ImportRecord record = importRecords.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "import record not found"));
		if (record.getStatus() != ImportStatus.PENDING) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "already reviewed: " + record.getStatus());
		}
		return record;
	}
}
