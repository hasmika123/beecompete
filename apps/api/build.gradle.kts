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
	// Web on Undertow, not the default Tomcat (architecture §3).
	implementation("org.springframework.boot:spring-boot-starter-web") {
		exclude(group = "org.springframework.boot", module = "spring-boot-starter-tomcat")
	}
	implementation("org.springframework.boot:spring-boot-starter-undertow")

	// Persistence (F4): Spring Data JPA + Hibernate, PostgreSQL, Liquibase migrations
	// (architecture §3 Persistence). No entities yet — R1-1 adds the first schema.
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.liquibase:liquibase-core")
	runtimeOnly("org.postgresql:postgresql")

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
