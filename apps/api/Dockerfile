# Spring Boot API production image. Multi-stage: build the bootJar with Gradle, then run
# it on a slim JRE as a non-root user. Build context is the REPO ROOT:
#   docker build -f apps/api/Dockerfile -t beecompete-api .
# Tests are skipped here (-x test) — they run in CI (F5); the image build just packages.
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /build
# Copy the build definition first so the dependency-download layer is cached across
# source-only changes (a src/ edit no longer re-downloads Gradle + every dependency).
COPY apps/api/gradlew apps/api/settings.gradle.kts apps/api/build.gradle.kts ./
COPY apps/api/gradle/ gradle/
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon > /dev/null
COPY apps/api/src/ src/
RUN ./gradlew bootJar --no-daemon -x test

FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /build/build/libs/*.jar app.jar
USER app
EXPOSE 8080
# Config (DATABASE_URL, DIRECT_URL, …) is injected via environment at runtime. Memory is
# bounded by the compose mem_limit + JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage (deploy stacks).
ENTRYPOINT ["java", "-jar", "app.jar"]
