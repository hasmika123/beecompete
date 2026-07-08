/**
 * {@code platform} module — cross-cutting infrastructure: files, background jobs,
 * feature flags, config, and shared web plumbing (architecture §4).
 *
 * <p>Owns its entities, services, and API. Cross-module calls come in through this
 * module's service interfaces only — never reach into another module's internals.
 *
 * <p>Skeleton (F2): hosts the {@code /api/v1/ping} health/wiring endpoint. Durable
 * jobs (Postgres queue, {@code FOR UPDATE SKIP LOCKED}), files (S3 pre-signed URLs),
 * and flags land in later tasks.
 */
package com.beecompete.platform;
