package com.beecompete.platform.web;

import java.time.Instant;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Maps expected-but-conflicting persistence outcomes to 409 so normal admin actions don't
 * surface as 500s (R1-3 review): deleting a category still referenced by competitions (FK
 * RESTRICT), a slug/natural-key race losing to the unique constraint, and a concurrent-edit
 * optimistic-lock miss (@Version). Bean-Validation (400) and ResponseStatusException (its own
 * status) are already handled by Spring Boot's defaults.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(OptimisticLockingFailureException.class)
	public ResponseEntity<Map<String, Object>> onOptimisticLock(OptimisticLockingFailureException ex) {
		return conflict("this record was modified by someone else — reload and retry");
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	public ResponseEntity<Map<String, Object>> onConstraint(DataIntegrityViolationException ex) {
		return conflict("the change conflicts with existing data (a unique or reference constraint)");
	}

	private ResponseEntity<Map<String, Object>> conflict(String message) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
				"timestamp", Instant.now().toString(),
				"status", HttpStatus.CONFLICT.value(),
				"error", HttpStatus.CONFLICT.getReasonPhrase(),
				"message", message));
	}
}
