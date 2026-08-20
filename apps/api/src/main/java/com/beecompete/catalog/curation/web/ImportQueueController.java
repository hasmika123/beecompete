package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.curation.CompetitionCurationService;
import com.beecompete.catalog.curation.CompetitionRequest;
import com.beecompete.catalog.curation.CompetitionWithEditionRequest;
import com.beecompete.catalog.curation.CurationStamps;
import com.beecompete.catalog.curation.EditionRequest;
import com.beecompete.catalog.curation.ListingCurationService;
import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.domain.ImportStatus;
import com.beecompete.catalog.repository.ImportRecordRepository;
import com.beecompete.catalog.domain.Provenance;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * R1-3 import-review queue. The S3 extraction pipeline POSTs extracted records (payload =
 * {@link CompetitionRequest} shape, validated on APPROVE, not ingress — garbage may enter the
 * queue, only reviewed data leaves it). Approve creates the real Competition - and its first
 * edition + key dates when the payload carries the optional {@code edition}/{@code keyDates}
 * keys (S3 v1) - with provenance {@code import} + the pipeline's confidence; curators edit the
 * payload before approving via the request body override. Reject discards with a note.
 */
@RestController
@RequestMapping("/api/v1/admin/import-records")
@Transactional
public class ImportQueueController {

	private final ImportRecordRepository importRecords;
	private final CompetitionCurationService curation;
	private final ListingCurationService listingCuration;
	private final ObjectMapper mapper;
	private final Validator validator;

	public ImportQueueController(ImportRecordRepository importRecords, CompetitionCurationService curation,
			ListingCurationService listingCuration, ObjectMapper mapper, Validator validator) {
		this.importRecords = importRecords;
		this.curation = curation;
		this.listingCuration = listingCuration;
		this.mapper = mapper;
		this.validator = validator;
	}

	@GetMapping
	@Transactional(readOnly = true)
	public Page<ImportRecordResponse> list(@RequestParam(defaultValue = "PENDING") ImportStatus status,
			@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
		return importRecords
				.findByStatusOrderByCreatedAt(status, PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100)))
				.map(ImportRecordResponse::from);
	}

	/** Any status — reviewed records render a read-only outcome panel; deep links always resolve. */
	@GetMapping("/{id}")
	@Transactional(readOnly = true)
	public ImportRecordResponse get(@PathVariable UUID id) {
		return ImportRecordResponse.from(importRecords.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "import record not found")));
	}

	/** Pipeline ingress (S3). Also usable manually to queue a record for review. */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ImportRecordResponse submit(@Valid @RequestBody ImportSubmission submission) {
		return ImportRecordResponse.from(importRecords.save(
				new ImportRecord(submission.payload(), submission.sourceUrl(), submission.confidence())));
	}

	/** Payload keys the S3 pipeline may add alongside the competition fields (v1). */
	private static final String EDITION_KEY = "edition";
	private static final String KEY_DATES_KEY = "keyDates";

	/**
	 * Approve: creates the Competition - plus its FIRST edition and typed key dates when the payload
	 * carries them (S3 v1). An optional body overrides the stored payload: the curator's "edit then
	 * approve" path. Validation (Bean Validation + category-template attributes) happens HERE, not at
	 * ingress - garbage may enter the queue, only reviewed data leaves it.
	 *
	 * <p><b>Why the edition belongs on approve.</b> Creating the competition alone leaves exactly the
	 * "zombie listing" (competition with no edition) that the readiness gate hides (domain-model
	 * &sect;8a) - tolerable one at a time, a catalog-wide problem when seeding hundreds. Carrying the
	 * edition through lets one approve produce a complete listing, atomically, via
	 * {@link ListingCurationService}.
	 *
	 * <p><b>Deliberately lenient - read before adding validation.</b> We assemble a
	 * {@link CompetitionWithEditionRequest} to reuse that atomic create, but validate its PARTS and
	 * never the wrapper. The wrapper's {@code @AssertTrue} rules encode the ADMIN CREATE FORM's
	 * completeness policy (organizer, summary, prize, region, registration URL ...); applying them
	 * here would make most extracted rows unapprovable, since a competition's own page routinely
	 * states no prize or fee. That split is the existing design intent - see the class note on
	 * {@link CompetitionWithEditionRequest}. Validating the wrapper here would silently break seeding.
	 */
	@PostMapping("/{id}/approve")
	public ImportRecordResponse approve(@PathVariable UUID id,
			@RequestBody(required = false) Map<String, Object> payloadOverride) {
		ImportRecord record = requirePending(id);
		Map<String, Object> payload = payloadOverride != null ? payloadOverride : record.getPayload();

		// Split the seeding extras OUT before mapping the competition half. Unknown properties are
		// ignored by default, so leaving them in would work only by luck; removing them keeps the
		// competition mapping honest.
		Map<String, Object> competitionPayload = new LinkedHashMap<>(payload);
		Object editionNode = competitionPayload.remove(EDITION_KEY);
		Object keyDatesNode = competitionPayload.remove(KEY_DATES_KEY);

		CompetitionRequest request = convertOrThrow(competitionPayload, CompetitionRequest.class, "competition");
		validateOrThrow(request, "payload invalid");

		Provenance stamp = CurationStamps.imported(record.getConfidence());
		Competition created;
		if (editionNode == null) {
			// Key dates hang off an edition; without one there is nothing to attach them to. Fail loudly
			// rather than dropping dates a curator believed they were approving.
			if (keyDatesNode != null) {
				throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
						"keyDates present without an edition - key dates belong to an edition");
			}
			created = curation.create(request, stamp);
		} else {
			EditionRequest edition = convertOrThrow(editionNode, EditionRequest.class, "edition");
			validateOrThrow(edition, "edition invalid");
			List<CompetitionWithEditionRequest.FirstEditionKeyDate> dates = convertKeyDates(keyDatesNode);
			dates.forEach(d -> validateOrThrow(d, "key date invalid"));
			created = listingCuration.createWithFirstEdition(
					new CompetitionWithEditionRequest(request, edition, dates, null), stamp);
		}

		record.setPayload(payload);
		record.setStatus(ImportStatus.APPROVED);
		record.setReviewedAt(Instant.now());
		record.setNote("created competition " + created.getId());
		return ImportRecordResponse.from(record);
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

	@PostMapping("/{id}/reject")
	public ImportRecordResponse reject(@PathVariable UUID id, @RequestBody(required = false) RejectRequest body) {
		ImportRecord record = requirePending(id);
		record.setStatus(ImportStatus.REJECTED);
		record.setReviewedAt(Instant.now());
		record.setNote(body != null ? body.note() : null);
		return ImportRecordResponse.from(record);
	}

	private ImportRecord requirePending(UUID id) {
		ImportRecord record = importRecords.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "import record not found"));
		if (record.getStatus() != ImportStatus.PENDING) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "already reviewed: " + record.getStatus());
		}
		return record;
	}

	public record ImportSubmission(@NotNull Map<String, Object> payload, @Size(max = 1000) String sourceUrl,
			@DecimalMin("0.00") @DecimalMax("1.00") BigDecimal confidence) {}

	public record RejectRequest(String note) {}

	public record ImportRecordResponse(UUID id, Map<String, Object> payload, String sourceUrl,
			BigDecimal confidence, String status, String origin, String note, Instant reviewedAt,
			Instant createdAt) {
		static ImportRecordResponse from(ImportRecord r) {
			return new ImportRecordResponse(r.getId(), r.getPayload(), r.getSourceUrl(), r.getConfidence(),
					r.getStatus().name(), r.getOrigin().name(), r.getNote(), r.getReviewedAt(), r.getCreatedAt());
		}
	}
}
