package com.beecompete.platform.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * R1-3 admin gate: every {@code /api/v1/admin/**} request must carry the shared-secret
 * {@code X-Admin-Token} header (injected by the web BFF, which itself sits behind Cloudflare
 * Access — the browser never holds the token). Fail-closed: a blank/unset {@code ADMIN_API_TOKEN}
 * rejects ALL admin calls. This is the R1 stopgap; real RBAC replaces it at R2-7. The API is
 * additionally unreachable from outside the box (internal Docker network — BFF pattern).
 */
@Component
public class AdminTokenFilter extends OncePerRequestFilter {

	public static final String HEADER = "X-Admin-Token";
	private static final String ADMIN_PATH_PREFIX = "/api/v1/admin";

	private final String expectedToken;

	public AdminTokenFilter(@Value("${admin.api-token:}") String expectedToken) {
		this.expectedToken = expectedToken;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !request.getRequestURI().startsWith(ADMIN_PATH_PREFIX);
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			FilterChain filterChain) throws ServletException, IOException {
		String presented = request.getHeader(HEADER);
		if (expectedToken.isBlank() || presented == null || !constantTimeEquals(expectedToken, presented)) {
			response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "admin token required");
			return;
		}
		filterChain.doFilter(request, response);
	}

	private static boolean constantTimeEquals(String expected, String presented) {
		return MessageDigest.isEqual(
				expected.getBytes(StandardCharsets.UTF_8), presented.getBytes(StandardCharsets.UTF_8));
	}
}
