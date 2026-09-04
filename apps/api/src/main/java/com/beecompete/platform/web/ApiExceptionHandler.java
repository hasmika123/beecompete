package com.beecompete.platform.web;

import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/**
 * Renders API errors as JSON with a useful {@code message}. Spring Boot's default hides exception
 * messages ({@code server.error.include-message=never}), which left the admin UI showing a bare
 * "admin API 422" instead of the actual reason. Here we deliberately echo the reasons WE set
 * (validation, conflicts) — not arbitrary exception internals — so the curation tool can show them.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

	/** Our controllers throw ResponseStatusException with an explicit, safe-to-show reason. */
	@ExceptionHandler(ResponseStatusException.class)
	public ResponseEntity<Map<String, Object>> onResponseStatus(ResponseStatusException ex) {
		return body(ex.getStatusCode(), ex.getReason() != null ? ex.getReason() : "request failed");
	}

	/** Bean Validation on @RequestBody — surface which fields failed. */
	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> onInvalidBody(MethodArgumentNotValidException ex) {
		String fields = ex.getBindingResult().getFieldErrors().stream()
				.map(fe -> fe.getField() + " " + fe.getDefaultMessage())
				.collect(Collectors.joining("; "));
		return body(HttpStatus.BAD_REQUEST, fields.isBlank() ? "invalid request body" : fields);
	}

	@ExceptionHandler(OptimisticLockingFailureException.class)
	public ResponseEntity<Map<String, Object>> onOptimisticLock(OptimisticLockingFailureException ex) {
		return body(HttpStatus.CONFLICT, "this record was modified by someone else; reload and retry");
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	public ResponseEntity<Map<String, Object>> onConstraint(DataIntegrityViolationException ex) {
		// The duplicate guard's DB backstop (0026): two curators creating the same listing at once
		// both pass the service check, and the loser lands here. Name the rule, as the service would.
		if (mentions(ex, "uq_competition_name_key_live")) {
			return body(HttpStatus.CONFLICT,
					"a live listing with this name was created at the same moment — rename this one to tell them apart");
		}
		if (mentions(ex, "uq_competition_slug")) {
			return body(HttpStatus.CONFLICT, "slug already exists");
		}
		return body(HttpStatus.CONFLICT, "the change conflicts with existing data (a unique or reference constraint)");
	}

	/** Whether the constraint name appears anywhere down the cause chain (the driver puts it in the root). */
	private static boolean mentions(Throwable ex, String constraint) {
		for (Throwable t = ex; t != null; t = t.getCause()) {
			if (t.getMessage() != null && t.getMessage().contains(constraint)) {
				return true;
			}
		}
		return false;
	}

	private ResponseEntity<Map<String, Object>> body(HttpStatusCode status, String message) {
		return ResponseEntity.status(status).body(Map.of(
				"timestamp", Instant.now().toString(),
				"status", status.value(),
				"message", message));
	}
}
