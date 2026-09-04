package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.curation.CompetitionRequest;
import com.beecompete.catalog.curation.DuplicateDetectionService;
import com.beecompete.catalog.curation.ImportReviewService;
import com.beecompete.catalog.domain.ImportOrigin;
import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.domain.ImportStatus;
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
import java.util.UUID;
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
 *
 * <p><b>Duplicate flags (DQ4).</b> Every response carries the record's strongest catalog match
 * ({@code duplicate}) and how many other PENDING records look like the same competition
 * ({@code pendingTwins}). The list computes only the cheap key/slug signals, in one query per
 * page; the single-record read and the ingest response run full detection (similar names too)
 * and add it as {@code duplicates}. Ingest still ACCEPTS a flagged record — the queue is lenient
 * by design and re-extraction is a real use — it flags, and the submitter decides.
 */
@RestController
@RequestMapping("/api/v1/admin/import-records")
public class ImportQueueController {

	/** Cap on one bulk request — a curator's batch, not a migration; keeps a slow approve loop bounded. */
	private static final int BULK_LIMIT = 100;

	private final ImportRecordRepository importRecords;
	private final DuplicateDetectionService duplicates;
	private final ImportReviewService review;

	public ImportQueueController(ImportRecordRepository importRecords, DuplicateDetectionService duplicates,
			ImportReviewService review) {
		this.importRecords = importRecords;
		this.duplicates = duplicates;
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
		Map<UUID, DuplicateDetectionService.RecordDuplicateSummary> summaries = duplicates
				.summarizeImportRecords(records.getContent().stream().map(ImportRecord::getId).toList());
		return records.map(r -> ImportRecordResponse.from(r, summaries.get(r.getId()), null));
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
		return withFullDetection(record);
	}

	/**
	 * Pipeline ingress (S3). Also usable manually to queue a record for review. The response carries
	 * the full duplicate detection so the seeding tool can say "already listed as X" / "already
	 * pending as Y" in its report — the record is queued either way.
	 */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Transactional
	public ImportRecordResponse submit(@Valid @RequestBody ImportSubmission submission) {
		// Flushed so the row — and its DB-generated keys — exists before detection runs against the
		// rest of the queue; the new record itself is excluded from its own twins by id.
		ImportRecord saved = importRecords.saveAndFlush(
				new ImportRecord(submission.payload(), submission.sourceUrl(), submission.confidence()));
		return withFullDetection(saved);
	}

	@PostMapping("/{id}/approve")
	public ImportRecordResponse approve(@PathVariable UUID id,
			@RequestBody(required = false) Map<String, Object> payloadOverride) {
		return ImportRecordResponse.from(review.approve(id, payloadOverride), null, null);
	}

	@PostMapping("/{id}/reject")
	public ImportRecordResponse reject(@PathVariable UUID id, @RequestBody(required = false) RejectRequest body) {
		return ImportRecordResponse.from(review.reject(id, body != null ? body.note() : null), null, null);
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

	/** Full detection (similar names included) for one record — the review page and the ingest reply. */
	private ImportRecordResponse withFullDetection(ImportRecord record) {
		DuplicateDetectionService.CompetitionDuplicates found = duplicates.findForImportRecord(record);
		return ImportRecordResponse.from(record,
				new DuplicateDetectionService.RecordDuplicateSummary(found.best(), found.pending().size()), found);
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

	/**
	 * {@code duplicate} = the strongest catalog match (null when none); {@code pendingTwins} = how
	 * many OTHER pending records look like the same competition; {@code duplicates} = the full
	 * detection, only on the single-record read and the ingest reply (null on the list, where only
	 * the cheap signals are computed).
	 */
	public record ImportRecordResponse(UUID id, Map<String, Object> payload, String sourceUrl,
			BigDecimal confidence, String status, String origin, String note, Instant reviewedAt,
			Instant createdAt, DuplicateDetectionService.CompetitionCandidate duplicate, int pendingTwins,
			DuplicateDetectionService.CompetitionDuplicates duplicates) {

		static ImportRecordResponse from(ImportRecord r, DuplicateDetectionService.RecordDuplicateSummary summary,
				DuplicateDetectionService.CompetitionDuplicates full) {
			return new ImportRecordResponse(r.getId(), r.getPayload(), r.getSourceUrl(), r.getConfidence(),
					r.getStatus().name(), r.getOrigin().name(), r.getNote(), r.getReviewedAt(), r.getCreatedAt(),
					summary != null ? summary.duplicate() : null, summary != null ? summary.pendingTwins() : 0, full);
		}
	}
}
