package com.beecompete.catalog.web;

import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.repository.ImportRecordRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.LinkedHashMap;
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
 * Public "Request a Competition" intake (R1-15b, DQ15): anyone can suggest a competition we
 * don't list yet. Unlike a correction (which edits an existing record), a request describes a
 * brand-new listing, so it lands in the {@code import_record} curation queue as a low-signal,
 * user-submitted candidate — a curator reviews/edits/approves it into a real Competition (the
 * same path the S3 import pipeline uses). No auth at R1 (no accounts until R2); abuse controls
 * are the size caps here + the web-form honeypot, plus the edge WAF/rate-limit at the R1-17 gate.
 *
 * <p>Deliberately collects NO submitter PII (no email) — the request is about the competition,
 * not the person, which keeps this COPPA-clear. Follow / host-interest email captures are
 * separate, framed flows (Brevo, R1-15b).
 */
@RestController
@RequestMapping("/api/v1/competition-requests")
public class CompetitionRequestPublicController {

	/** Serialized-payload cap — a request is a handful of short fields, not a document. */
	private static final int MAX_PAYLOAD_CHARS = 8000;

	private static final String REQUEST_NOTE = "Public request via the Request-a-Competition form (DQ15).";

	private final ImportRecordRepository imports;
	private final ObjectMapper mapper;

	public CompetitionRequestPublicController(ImportRecordRepository imports, ObjectMapper mapper) {
		this.imports = imports;
		this.mapper = mapper;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public RequestSubmitted submit(@Valid @RequestBody CompetitionRequestSubmission submission) {
		Map<String, Object> payload = buildPayload(submission);
		requireModestSize(payload);
		// confidence = null: this isn't a pipeline extraction; the null + the note flag it as a
		// user request in the admin queue (vs. an S3 import which carries a confidence score).
		ImportRecord record = new ImportRecord(payload, blankToNull(submission.officialUrl()), null);
		record.setNote(REQUEST_NOTE);
		record = imports.save(record);
		return new RequestSubmitted(record.getId(), record.getStatus().name(), record.getCreatedAt());
	}

	/** Only carry the fields the requester actually filled in (curators complete the rest). */
	private Map<String, Object> buildPayload(CompetitionRequestSubmission s) {
		Map<String, Object> payload = new LinkedHashMap<>();
		putIfPresent(payload, "name", s.name());
		putIfPresent(payload, "organizerName", s.organizerName());
		putIfPresent(payload, "officialUrl", s.officialUrl());
		putIfPresent(payload, "categorySlug", s.categorySlug());
		putIfPresent(payload, "grades", s.grades());
		putIfPresent(payload, "deadline", s.deadline());
		putIfPresent(payload, "details", s.details());
		return payload;
	}

	private void putIfPresent(Map<String, Object> payload, String key, String value) {
		if (value != null && !value.isBlank()) {
			payload.put(key, value.trim());
		}
	}

	private String blankToNull(String value) {
		return (value == null || value.isBlank()) ? null : value.trim();
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

	public record CompetitionRequestSubmission(@NotBlank @Size(max = 300) String name,
			@Size(max = 300) String organizerName, @Size(max = 1000) String officialUrl,
			@Size(max = 100) String categorySlug, @Size(max = 200) String grades, @Size(max = 200) String deadline,
			@Size(max = 2000) String details) {}

	/** Deliberately minimal — the public gets an acknowledgement, not the queue's internals. */
	public record RequestSubmitted(UUID id, String status, Instant createdAt) {}
}
