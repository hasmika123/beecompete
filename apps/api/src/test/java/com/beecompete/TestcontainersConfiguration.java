package com.beecompete;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Provides a real Postgres for integration tests via Testcontainers. {@code @ServiceConnection}
 * wires {@code spring.datasource.*} to the container automatically, so tests exercise the
 * same database engine as prod (JSONB, FTS) — no H2. Requires Docker to be running.
 */
@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

	@Bean
	@ServiceConnection
	PostgreSQLContainer<?> postgresContainer() {
		return new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));
	}
}
