package com.beecompete.platform.web;

import io.sentry.Sentry;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * WHO made an admin write. Curators sign in individually through Cloudflare Access; Access puts
 * the authenticated address in {@code Cf-Access-Authenticated-User-Email}, and the web BFF
 * forwards it here as {@link #HEADER}. This filter parks it on the MDC for the request, tags
 * Sentry with it, and logs one line per mutating admin call.
 *
 * <p><b>Advisory, never authorization.</b> Access itself is the gate, and {@link AdminTokenFilter}
 * is the one that can reject: this value only labels an already-authorized request. It is NOT
 * cryptographically verified here — a caller that reached the origin directly, bypassing
 * Cloudflare, could set any address. That only pollutes the audit label, never grants entry.
 * Verifying {@code Cf-Access-Jwt-Assertion} against Access's JWKS is the upgrade if this ever
 * needs to be trusted rather than merely useful; real identity arrives with RBAC at R2-7.
 *
 * <p>Deliberately NOT persisted to a column. {@code import_record.reviewed_by} is already a
 * {@code UUID} reserved for a real user id, and {@code approved_by} is committed to the same shape
 * (sweep-remediation-plan §14) — writing an email string alongside them now would create a second
 * identity representation to reconcile at R2-7. Logs answer "who did this" today; the queue note
 * ({@code ImportReviewService}) carries it for the one action where curators need it in-app.
 */
public class CuratorAuditFilter extends OncePerRequestFilter {

	public static final String HEADER = "X-Curator-Email";

	/** MDC key — allow-listed into the JSON encoder in logback-spring.xml. */
	public static final String MDC_KEY = "curator";

	private static final Logger log = LoggerFactory.getLogger(CuratorAuditFilter.class);

	/** Long enough for any real address (RFC 5321 caps at 254), short enough to bound a log line. */
	private static final int MAX_LENGTH = 254;

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			FilterChain filterChain) throws ServletException, IOException {
		String curator = sanitize(request.getHeader(HEADER));
		if (curator != null) {
			MDC.put(MDC_KEY, curator);
			Sentry.configureScope(scope -> scope.setTag(MDC_KEY, curator));
		}
		try {
			filterChain.doFilter(request, response);
		}
		finally {
			// AFTER the chain, so the status is the real one. Reads are noise at curation volume;
			// only writes are worth a line.
			if (isMutating(request)) {
				log.info("admin write {} {} by {} -> {}", request.getMethod(),
						request.getRequestURI(), curator != null ? curator : "unattributed",
						response.getStatus());
			}
			MDC.remove(MDC_KEY); // pooled threads outlive the request
		}
	}

	private static boolean isMutating(HttpServletRequest request) {
		String method = request.getMethod();
		return "POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method)
				|| "DELETE".equals(method);
	}

	/**
	 * Header value → a safe single-line label, or null. Strips CR/LF and other control characters:
	 * this string reaches a log line, and an unfiltered newline lets a caller forge log entries.
	 */
	static String sanitize(String raw) {
		if (raw == null) {
			return null;
		}
		String cleaned = raw.replaceAll("\\p{Cntrl}", "").trim();
		if (cleaned.isEmpty()) {
			return null;
		}
		return cleaned.length() > MAX_LENGTH ? cleaned.substring(0, MAX_LENGTH) : cleaned;
	}

	/** The curator on the CURRENT request, or null when unattributed (scripts, local dev). */
	public static String current() {
		return MDC.get(MDC_KEY);
	}
}
