plugins {
	java
	id("org.springframework.boot") version "3.5.16"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "com.beecompete"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		// App targets Java 21 (LTS, architecture §3). Gradle auto-provisions it via the
		// Foojay resolver (settings.gradle.kts) even when only other JDKs are installed.
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	// Web on default Tomcat. (Undertow dropped 2026-07-12: deprecated in Boot 3.5,
	// removed in Boot 4, and virtual threads — spring.threads.virtual — only apply to
	// Tomcat/Jetty request processing, so the original rationale was inoperative.)
	implementation("org.springframework.boot:spring-boot-starter-web")

	// Persistence (F4): Spring Data JPA + Hibernate, PostgreSQL, Liquibase migrations
	// (architecture §3 Persistence). R1-1 added the catalog schema.
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.liquibase:liquibase-core")
	runtimeOnly("org.postgresql:postgresql")

	// R1-2: validates a Competition's JSONB attributes bag against its Category Template's
	// JSON Schema (draft 2020-12; meta-schemas bundled — no network at runtime).
	implementation("com.networknt:json-schema-validator:1.5.6")

	// Observability (F8): Sentry error capture + Logback breadcrumbs (disabled when
	// SENTRY_DSN is blank), and JSON structured logs via the logstash encoder
	// (activated by the prod logging profile — logback-spring.xml). Architecture §Observability.
	implementation(platform("io.sentry:sentry-bom:7.18.1"))
	implementation("io.sentry:sentry-spring-boot-starter-jakarta")
	implementation("io.sentry:sentry-logback")
	implementation("net.logstash.logback:logstash-logback-encoder:8.0")

	testImplementation("org.springframework.boot:spring-boot-starter-test")
	// Integration tests run against a real Postgres via Testcontainers (needs Docker) —
	// no H2, so JSONB/FTS behave as in prod. @ServiceConnection wires the datasource.
	testImplementation("org.springframework.boot:spring-boot-testcontainers")
	testImplementation("org.testcontainers:junit-jupiter")
	testImplementation("org.testcontainers:postgresql")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
	useJUnitPlatform()
}

// Local dev only: `./gradlew bootRun` supplies a default ADMIN_API_TOKEN (matching the
// checked-in apps/web/.env.local `dev-admin-token`) UNLESS the environment already sets one,
// so a fresh bootRun + the web BFF agree out of the box. Without this the API boots with a
// blank token and rejects every /admin call with 401. It flows through the same
// `${ADMIN_API_TOKEN:}` binding as prod; an explicit export still wins. Production runs the
// built jar (`java -jar`), never this task, so the admin surface stays fail-closed there.
tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
	if (System.getenv("ADMIN_API_TOKEN") == null) {
		environment("ADMIN_API_TOKEN", "dev-admin-token")
	}
}
