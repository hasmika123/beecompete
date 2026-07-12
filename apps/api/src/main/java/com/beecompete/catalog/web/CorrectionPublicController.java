package com.beecompete.catalog.web;

import com.beecompete.catalog.curation.CorrectionApplyService;
import com.beecompete.catalog.domain.CorrectionProposal;
import com.beecompete.catalog.domain.CorrectionSubjectType;
import com.beecompete.catalog.repository.CorrectionProposalRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Public "Suggest a correction" intake (R1-3b, DQ6): anyone can queue a field-level diff
 * against a Competition/Edition/Resource; nothing is applied until a curator approves it in
 * the admin queue. No auth at R1 (no accounts until R2) — abuse controls are the field
 * whitelist + size caps here, plus the edge WAF/rate-limit switched on at the R1-17 gate.
 * {@code submittedByUserId} stays null until accounts exist (R2-1).
 */
@RestController
@RequestMapping("/api/v1/corrections")
public class CorrectionPublicController {

	/** Serialized-payload cap — a correction is a small diff, not a document. */
	private static final int MAX_PAYLOAD_CHARS = 8000;

	private final CorrectionProposalRepository proposals;
	private final CorrectionApplyService corrections;
	private final ObjectMapper mapper;

	public CorrectionPublicController(CorrectionProposalRepository proposals,
			CorrectionApplyService corrections, ObjectMapper mapper) {
		this.proposals = proposals;
		this.corrections = corrections;
		this.mapper = mapper;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public CorrectionSubmitted submit(@Valid @RequestBody CorrectionSubmission submission) {
		corrections.requireWhitelisted(submission.subjectType(), submission.payload());
		corrections.requireSubjectExists(submission.subjectType(), submission.subjectId());
		requireModestSize(submission.payload());
		CorrectionProposal proposal = new CorrectionProposal(submission.subjectType(), submission.subjectId(),
				submission.payload());
		proposal.setNote(submission.note());
		proposal = proposals.save(proposal);
		return new CorrectionSubmitted(proposal.getId(), proposal.getStatus().name(), proposal.getCreatedAt());
	}

	private void requireModestSize(Map<String, Object> payload) {
		try {
			if (mapper.writeValueAsString(payload).length() > MAX_PAYLOAD_CHARS) {
				throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "payload too large");
			}
		} catch (JsonProcessingException e) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "payload not serializable");
		}
	}

	public record CorrectionSubmission(@NotNull CorrectionSubjectType subjectType, @NotNull UUID subjectId,
			@NotEmpty Map<String, Object> payload, @Size(max = 2000) String note) {}

	/** Deliberately minimal — the public gets an acknowledgement, not the queue's internals. */
	public record CorrectionSubmitted(UUID id, String status, Instant createdAt) {}
}
