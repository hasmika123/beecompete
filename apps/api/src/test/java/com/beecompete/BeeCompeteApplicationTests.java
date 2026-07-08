package com.beecompete;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Sanity check that the full application context wires up and starts — now including
 * the datasource, Hibernate, and Liquibase. The Postgres container is provided by
 * {@link TestcontainersConfiguration} (needs Docker running).
 *
 * <p>Passing proves the F4 stack end-to-end: the app connects to a real Postgres and
 * Liquibase applies the baseline changelog on startup.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class BeeCompeteApplicationTests {

	@Test
	void contextLoads() {
	}

}
