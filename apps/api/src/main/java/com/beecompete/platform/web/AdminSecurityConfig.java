package com.beecompete.platform.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * Registers {@link AdminTokenFilter} scoped to {@code /api/v1/admin/*}. Servlet URL-pattern
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
}
