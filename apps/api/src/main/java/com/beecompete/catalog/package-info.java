/**
 * {@code catalog} module — competition, edition, category, region, resource
 * (architecture §4; domain-model §7).
 *
 * <p>Owns its entities, services, and API. Cross-module calls come in through this
 * module's service interfaces only — never reach into another module's internals.
 *
 * <p>{@code domain} holds the JPA entities, enums, and embeddables (R1-1 core schema —
 * typed Spine columns + validated JSONB {@code attributes}); {@code repository} holds the
 * Spring Data repositories. The catalog API (services + controllers) lands in R1-4.
 */
package com.beecompete.catalog;
