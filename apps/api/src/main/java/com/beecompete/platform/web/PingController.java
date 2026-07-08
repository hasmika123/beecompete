package com.beecompete.platform.web;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Skeleton wiring check for the API (F2): proves the app boots, serves versioned
 * JSON under {@code /api/v1}, and enforces Bean Validation on request input.
 *
 * <p>Not a product endpoint — real catalog/discovery APIs land in R1. Liveness and
 * readiness are served separately by Actuator at {@code /actuator/health}.
 *
 * <p>Constraints on the request parameter are validated natively by Spring MVC
 * (Framework 6.1+); a violation yields a {@code HandlerMethodValidationException}
 * that Spring Boot renders as HTTP 400 — no class-level {@code @Validated} needed.
 */
@RestController
@RequestMapping("/api/v1")
public class PingController {

	@GetMapping("/ping")
	public PingResponse ping(
			@RequestParam(defaultValue = "world")
			@Size(min = 1, max = 40, message = "name must be 1–40 characters")
			@Pattern(
					regexp = "[A-Za-z0-9 _-]+",
					message = "name may contain only letters, digits, spaces, underscores, or hyphens")
			String name) {
		return new PingResponse("ok", "BeeCompete API", "Hello, " + name + "!");
	}
}
