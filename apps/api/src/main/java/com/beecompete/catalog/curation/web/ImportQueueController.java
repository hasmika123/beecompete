package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.curation.CompetitionCurationService;
import com.beecompete.catalog.curation.CompetitionRequest;
import com.beecompete.catalog.curation.CurationStamps;
import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.domain.ImportStatus;
import com.beecompete.catalog.repository.ImportRecordRepository;
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
 * queue, only reviewed data leaves it). Approve creates the real Competition with provenance
 * {@code import} + the pipeline's confidence; curators edit the payload before approving via
 * the request body override. Reject discards with a note.
 */
@RestController
@RequestMapping("/api/v1/admin/import-records")
@Transactional
public class ImportQueueController {

	private final ImportRecordRepository importRecords;
	private final CompetitionCurationService curation;
	private final ObjectMapper mapper;
	private final Validator validator;

	public ImportQueueController(ImportRecordRepository importRecords, CompetitionCurationService curation,
			ObjectMapper mapper, Validator validator) {
		this.importRecords = importRecords;
		this.curation = curation;
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

	/** Pipeline ingress (S3). Also usable manually to queue a record for review. */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ImportRecordResponse submit(@Valid @RequestBody ImportSubmission submission) {
		return ImportRecordResponse.from(importRecords.save(
				new ImportRecord(submission.payload(), submission.sourceUrl(), submission.confidence())));
	}

	/**
	 * Approve: creates the Competition. An optional body overrides the stored payload — that's
	 * the curator's "edit then approve" path. Validation (Bean Validation + category-template
	 * attributes) happens HERE, so a malformed extraction fails the approve, not the ingress.
	 */
	@PostMapping("/{id}/approve")
	public ImportRecordResponse approve(@PathVariable UUID id,
			@RequestBody(required = false) Map<String, Object> payloadOverride) {
		ImportRecord record = requirePending(id);
		Map<String, Object> payload = payloadOverride != null ? payloadOverride : record.getPayload();
		CompetitionRequest request;
		try {
			request = mapper.convertValue(payload, CompetitionRequest.class);
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"payload does not parse as a competition: " + e.getMessage());
		}
		Set<ConstraintViolation<CompetitionRequest>> violations = validator.validate(request);
		if (!violations.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "payload invalid: " + violations
					.stream()
					.map(v -> v.getPropertyPath() + " " + v.getMessage())
					.collect(Collectors.joining("; ")));
		}
		Competition created = curation.create(request, CurationStamps.imported(record.getConfidence()));
		record.setPayload(payload);
		record.setStatus(ImportStatus.APPROVED);
		record.setReviewedAt(Instant.now());
		record.setNote("created competition " + created.getId());
		return ImportRecordResponse.from(record);
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
			BigDecimal confidence, String status, String note, Instant reviewedAt, Instant createdAt) {
		static ImportRecordResponse from(ImportRecord r) {
			return new ImportRecordResponse(r.getId(), r.getPayload(), r.getSourceUrl(), r.getConfidence(),
					r.getStatus().name(), r.getNote(), r.getReviewedAt(), r.getCreatedAt());
		}
	}
}
