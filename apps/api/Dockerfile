# Spring Boot API production image. Multi-stage: build the bootJar with Gradle, then run
# it on a slim JRE as a non-root user. Build context is the REPO ROOT:
#   docker build -f apps/api/Dockerfile -t beecompete-api .
# Tests are skipped here (-x test) — they run in CI (F5); the image build just packages.
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /build
COPY apps/api/ .
RUN chmod +x gradlew && ./gradlew clean bootJar --no-daemon -x test

FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /build/build/libs/*.jar app.jar
USER app
EXPOSE 8080
# Config (DATABASE_URL, DIRECT_URL, …) is injected via environment at runtime.
ENTRYPOINT ["java", "-jar", "app.jar"]
