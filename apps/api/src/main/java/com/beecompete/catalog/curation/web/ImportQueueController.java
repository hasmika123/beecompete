package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.curation.CompetitionRequest;
import com.beecompete.catalog.curation.ImportReviewService;
import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.ImportOrigin;
import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.domain.ImportStatus;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.ImportRecordRepository;
import com.beecompete.catalog.repository.ImportRecordSort;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
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
 * queue, only reviewed data leaves it). Approve creates the real Competition — and its first
 * edition + key dates + regions when the payload carries the optional {@code edition} /
 * {@code keyDates} / {@code regionIds} keys — with provenance {@code import} + the pipeline's
 * confidence; curators edit the payload before approving via the request body override, which is
 * how the admin review FORM submits. Reject discards with a note. The decision logic itself lives
 * in {@link ImportReviewService} so bulk review can run each record in its own transaction.
 */
@RestController
@RequestMapping("/api/v1/admin/import-records")
public class ImportQueueController {

	/** Cap on one bulk request — a curator's batch, not a migration; keeps a slow approve loop bounded. */
	private static final int BULK_LIMIT = 100;

	private final ImportRecordRepository importRecords;
	private final CompetitionRepository competitions;
	private final ImportReviewService review;

	public ImportQueueController(ImportRecordRepository importRecords, CompetitionRepository competitions,
			ImportReviewService review) {
		this.importRecords = importRecords;
		this.competitions = competitions;
		this.review = review;
	}

	/**
	 * One page of the queue, filtered and sorted. Everything but {@code status} is optional so the
	 * original call ({@code ?status=PENDING&page=0}) keeps behaving as it did: oldest first.
	 */
	@GetMapping
	@Transactional(readOnly = true)
	public Page<ImportRecordResponse> list(@RequestParam(defaultValue = "PENDING") ImportStatus status,
			@RequestParam(required = false) ImportOrigin origin, @RequestParam(required = false) String query,
			@RequestParam(defaultValue = "CREATED_AT") ImportRecordSort sort,
			@RequestParam(defaultValue = "false") boolean desc, @RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "25") int size) {
		Page<ImportRecord> records = importRecords.search(status, origin, query, sort, desc,
				PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100)));
		Map<String, UUID> collisions = slugCollisions(records.getContent());
		return records.map(r -> ImportRecordResponse.from(r, collisions));
	}

	/** Queue depth per tab — so the list can label its tabs and show how much review work is left. */
	@GetMapping("/counts")
	@Transactional(readOnly = true)
	public Map<ImportStatus, Long> counts() {
		Map<ImportStatus, Long> counts = new EnumMap<>(ImportStatus.class);
		for (ImportStatus status : ImportStatus.values()) {
			counts.put(status, importRecords.countByStatus(status));
		}
		return counts;
	}

	/** Any status — reviewed records render a read-only outcome panel; deep links always resolve. */
	@GetMapping("/{id}")
	@Transactional(readOnly = true)
	public ImportRecordResponse get(@PathVariable UUID id) {
		ImportRecord record = importRecords.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "import record not found"));
		return ImportRecordResponse.from(record, slugCollisions(List.of(record)));
	}

	/** Pipeline ingress (S3). Also usable manually to queue a record for review. */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Transactional
	public ImportRecordResponse submit(@Valid @RequestBody ImportSubmission submission) {
		ImportRecord saved = importRecords.save(
				new ImportRecord(submission.payload(), submission.sourceUrl(), submission.confidence()));
		return ImportRecordResponse.from(saved, Map.of());
	}

	@PostMapping("/{id}/approve")
	public ImportRecordResponse approve(@PathVariable UUID id,
			@RequestBody(required = false) Map<String, Object> payloadOverride) {
		return ImportRecordResponse.from(review.approve(id, payloadOverride), Map.of());
	}

	@PostMapping("/{id}/reject")
	public ImportRecordResponse reject(@PathVariable UUID id, @RequestBody(required = false) RejectRequest body) {
		return ImportRecordResponse.from(review.reject(id, body != null ? body.note() : null), Map.of());
	}

	/**
	 * Review many records with one decision — the S4 curation gesture for a batch that is obviously
	 * good (or obviously junk from one bad source).
	 *
	 * <p>Deliberately NOT all-or-nothing: each record is decided in its own transaction and reports
	 * its own outcome, so one row failing template validation doesn't discard the twenty that
	 * succeeded. The response is therefore always 200 with per-id results, never a 422 for the batch
	 * — the caller renders which rows still need attention. Approving in bulk skips the per-record
	 * review form by design, so the UI restricts it to rows it can show are safe.
	 */
	@PostMapping("/bulk")
	public BulkReviewResponse bulk(@Valid @RequestBody BulkReviewRequest body) {
		List<UUID> ids = body.ids().stream().distinct().toList();
		if (ids.size() > BULK_LIMIT) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"too many records in one bulk request (max " + BULK_LIMIT + ")");
		}
		List<BulkOutcome> results = new ArrayList<>(ids.size());
		for (UUID id : ids) {
			try {
				ImportRecord decided = body.action() == BulkAction.APPROVE
						? review.approve(id, null)
						: review.reject(id, body.note());
				results.add(new BulkOutcome(id, true, decided.getStatus().name(), null));
			} catch (ResponseStatusException e) {
				// The expected failure (unapprovable extraction, already reviewed) — report and continue.
				results.add(new BulkOutcome(id, false, null, e.getReason() != null ? e.getReason() : e.getMessage()));
			} catch (RuntimeException e) {
				results.add(new BulkOutcome(id, false, null, e.getMessage()));
			}
		}
		long succeeded = results.stream().filter(BulkOutcome::ok).count();
		return new BulkReviewResponse((int) succeeded, results.size() - (int) succeeded, results);
	}

	/**
	 * Which of these records' payload slugs are already taken in the catalog — the duplicate warning
	 * curators need BEFORE approving (approving over a taken slug is a 409 they'd otherwise meet as a
	 * raw error). One query per page rather than one per row.
	 */
	private Map<String, UUID> slugCollisions(List<ImportRecord> records) {
		Set<String> slugs = records.stream()
				.map(ImportRecordResponse::slugOf)
				.filter(s -> s != null)
				.collect(Collectors.toSet());
		if (slugs.isEmpty()) {
			return Map.of();
		}
		return competitions.findBySlugIn(slugs).stream()
				.collect(Collectors.toMap(Competition::getSlug, Competition::getId, (a, b) -> a));
	}

	public record ImportSubmission(@NotNull Map<String, Object> payload, @Size(max = 1000) String sourceUrl,
			@DecimalMin("0.00") @DecimalMax("1.00") BigDecimal confidence) {}

	public record RejectRequest(String note) {}

	public enum BulkAction {
		APPROVE, REJECT
	}

	public record BulkReviewRequest(@NotEmpty List<UUID> ids, @NotNull BulkAction action,
			@Size(max = 2000) String note) {}

	/** Per-record result. {@code status} is the new lifecycle state on success, {@code error} the reason otherwise. */
	public record BulkOutcome(UUID id, boolean ok, String status, String error) {}

	public record BulkReviewResponse(int succeeded, int failed, List<BulkOutcome> results) {}

	public record ImportRecordResponse(UUID id, Map<String, Object> payload, String sourceUrl,
			BigDecimal confidence, String status, String origin, String note, Instant reviewedAt,
			Instant createdAt, UUID duplicateCompetitionId) {

		static ImportRecordResponse from(ImportRecord r, Map<String, UUID> slugCollisions) {
			String slug = slugOf(r);
			return new ImportRecordResponse(r.getId(), r.getPayload(), r.getSourceUrl(), r.getConfidence(),
					r.getStatus().name(), r.getOrigin().name(), r.getNote(), r.getReviewedAt(), r.getCreatedAt(),
					slug == null ? null : slugCollisions.get(slug));
		}

		/** The payload is untrusted JSON — a non-string slug is simply "no slug to check". */
		static String slugOf(ImportRecord r) {
			return extractText(r.getPayload(), "slug");
		}

		private static String extractText(Map<String, Object> payload, String key) {
			Object value = payload == null ? null : payload.get(key);
			return value instanceof String s && !s.isBlank() ? s : null;
		}
	}
}
