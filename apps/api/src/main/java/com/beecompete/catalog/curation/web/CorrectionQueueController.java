package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.curation.CorrectionApplyService;
import com.beecompete.catalog.domain.CorrectionProposal;
import com.beecompete.catalog.domain.CorrectionStatus;
import com.beecompete.catalog.repository.CorrectionProposalRepository;
import java.time.Instant;
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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * R1-3b correction review queue (DQ6). Approve applies the field-level diff to the subject
 * record through the curation write path (validation + provenance stamping identical to a
 * direct admin edit) — an optional body overrides the stored payload (the curator's
 * "edit then approve"). Reject discards. The submitter's note is preserved; curator activity
 * is appended as {@code [curator]} lines — the reviewed row is the R1 audit record (D7;
 * ActivityEvent logging lands at R2-9). {@code reviewedBy} stays null until admin identities
 * exist (R2-7 RBAC).
 */
@RestController
@RequestMapping("/api/v1/admin/corrections")
@Transactional
public class CorrectionQueueController {

	private final CorrectionProposalRepository proposals;
	private final CorrectionApplyService corrections;

	public CorrectionQueueController(CorrectionProposalRepository proposals, CorrectionApplyService corrections) {
		this.proposals = proposals;
		this.corrections = corrections;
	}

	@GetMapping
	@Transactional(readOnly = true)
	public Page<CorrectionResponse> list(@RequestParam(defaultValue = "PENDING") CorrectionStatus status,
			@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
		Page<CorrectionProposal> result = proposals
				.findByStatusOrderByCreatedAt(status, PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100)));
		// Batched display names (keyed by proposal id) — the list column shows the subject's
		// NAME, not a bare UUID. ≤3 queries per page, never N+1.
		Map<UUID, String> names = corrections.subjectNames(result.getContent());
		return result.map(p -> CorrectionResponse.from(p, null, names.get(p.getId())));
	}

	/** Detail includes the subject's current whitelisted values — the "current vs proposed" panel. */
	@GetMapping("/{id}")
	@Transactional(readOnly = true)
	public CorrectionResponse get(@PathVariable UUID id) {
		CorrectionProposal proposal = require(id);
		Map<String, Object> current;
		try {
			current = corrections.currentValues(proposal.getSubjectType(), proposal.getSubjectId());
		} catch (ResponseStatusException e) {
			current = null; // subject archived-and-gone or hard-deleted (resource) — still reviewable
		}
		return CorrectionResponse.from(proposal, current,
				corrections.subjectNames(List.of(proposal)).get(proposal.getId()));
	}

	@PostMapping("/{id}/approve")
	public CorrectionResponse approve(@PathVariable UUID id,
			@RequestBody(required = false) Map<String, Object> payloadOverride) {
		CorrectionProposal proposal = requirePending(id);
		Map<String, Object> payload = payloadOverride != null ? payloadOverride : proposal.getPayload();
		String summary = corrections.apply(proposal, payload);
		proposal.setPayload(payload);
		proposal.setStatus(CorrectionStatus.APPROVED);
		proposal.setReviewedAt(Instant.now());
		proposal.setNote(appendCurator(proposal.getNote(), summary));
		return CorrectionResponse.from(proposal, null, null);
	}

	@PostMapping("/{id}/reject")
	public CorrectionResponse reject(@PathVariable UUID id, @RequestBody(required = false) RejectRequest body) {
		CorrectionProposal proposal = requirePending(id);
		proposal.setStatus(CorrectionStatus.REJECTED);
		proposal.setReviewedAt(Instant.now());
		if (body != null && body.note() != null && !body.note().isBlank()) {
			proposal.setNote(appendCurator(proposal.getNote(), body.note()));
		}
		return CorrectionResponse.from(proposal, null, null);
	}

	private static String appendCurator(String note, String line) {
		String curatorLine = "[curator] " + line;
		return note == null || note.isBlank() ? curatorLine : note + "\n" + curatorLine;
	}

	private CorrectionProposal require(UUID id) {
		return proposals.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "correction not found"));
	}

	private CorrectionProposal requirePending(UUID id) {
		CorrectionProposal proposal = require(id);
		if (proposal.getStatus() != CorrectionStatus.PENDING) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "already reviewed: " + proposal.getStatus());
		}
		return proposal;
	}

	public record RejectRequest(String note) {}

	public record CorrectionResponse(UUID id, String subjectType, UUID subjectId, String subjectName,
			Map<String, Object> payload, Map<String, Object> currentValues, String note, String status,
			Instant reviewedAt, Instant createdAt) {

		static CorrectionResponse from(CorrectionProposal p, Map<String, Object> currentValues,
				String subjectName) {
			return new CorrectionResponse(p.getId(), p.getSubjectType().name(), p.getSubjectId(), subjectName,
					p.getPayload(), currentValues, p.getNote(), p.getStatus().name(), p.getReviewedAt(),
					p.getCreatedAt());
		}
	}
}
