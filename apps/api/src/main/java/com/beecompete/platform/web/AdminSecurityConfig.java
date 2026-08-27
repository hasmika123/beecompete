package com.beecompete.platform.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * Registers the two {@code /api/v1/admin/*} filters: {@link AdminTokenFilter} (the gate) and
 * {@link CuratorAuditFilter} (who made the write — advisory only, runs after the gate so an
 * unauthorized request is never attributed).
 *
 * <p>{@link AdminTokenFilter} scoped to {@code /api/v1/admin/*}. Servlet URL-pattern
 * matching runs on the container's DECODED + normalized path, so percent-encoded variants that
 * still resolve to an admin handler (e.g. {@code /api/v1/%61dmin/…}) are covered — closing the
 * raw-URI-prefix bypass. Runs early (before the dispatcher) so no admin handler is reached
 * without the token.
 */
@Configuration
public class AdminSecurityConfig {

	@Bean
	public FilterRegistrationBean<AdminTokenFilter> adminTokenFilter(
			@Value("${admin.api-token:}") String expectedToken) {
		FilterRegistrationBean<AdminTokenFilter> registration =
				new FilterRegistrationBean<>(new AdminTokenFilter(expectedToken));
		registration.addUrlPatterns("/api/v1/admin/*");
		registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
		registration.setName("adminTokenFilter");
		return registration;
	}

	@Bean
	public FilterRegistrationBean<CuratorAuditFilter> curatorAuditFilter() {
		FilterRegistrationBean<CuratorAuditFilter> registration =
				new FilterRegistrationBean<>(new CuratorAuditFilter());
		registration.addUrlPatterns("/api/v1/admin/*");
		// Immediately AFTER the token filter: a rejected request must not be logged as a write,
		// and must never put an unverified address on the MDC.
		registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
		registration.setName("curatorAuditFilter");
		return registration;
	}
}
