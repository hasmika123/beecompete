package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Organization;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

	/** Curation dedup: the import pipeline looks orgs up by name before creating one. */
	Optional<Organization> findByNameIgnoreCase(String name);

	Page<Organization> findByNameContainingIgnoreCase(String name, Pageable pageable);

	/**
	 * Duplicate candidates for an organization (DQ4, migration 0026): same name key, same
	 * registrable domain, or a similar name — trigram over the threshold, or one name key
	 * containing the other (the rule the organizer resolver has always applied, in both
	 * directions). Blank parameters key to NULL and match nothing; {@code excludeId} is the row
	 * being edited or a sentinel. Archived rows are included — the resolver refuses an archived
	 * exact match rather than silently reusing it, so it has to see one.
	 */
	@Query(value = """
			SELECT o.id AS "id", o.name AS "name", o.type AS "type", o.domain AS "domain", o.archived_at AS "archivedAt",
			  (o.name_key = catalog_name_key(:name)) AS "nameExact",
			  (o.domain IS NOT NULL AND o.domain = :domain) AS "domainExact",
			  CAST(similarity(lower(o.name), lower(:name)) AS double precision) AS "similarity",
			  (o.name_key LIKE '%' || catalog_name_key(:name) || '%'
			    OR catalog_name_key(:name) LIKE '%' || o.name_key || '%') AS "contains"
			FROM organization o
			WHERE o.id <> :excludeId
			  AND (o.name_key = catalog_name_key(:name)
			    OR (o.domain IS NOT NULL AND o.domain = :domain)
			    OR similarity(lower(o.name), lower(:name)) >= :threshold
			    OR o.name_key LIKE '%' || catalog_name_key(:name) || '%'
			    OR catalog_name_key(:name) LIKE '%' || o.name_key || '%')
			ORDER BY (o.archived_at IS NULL AND o.name_key = catalog_name_key(:name)) DESC,
			  (o.name_key = catalog_name_key(:name)) DESC,
			  (o.domain IS NOT NULL AND o.domain = :domain) DESC,
			  similarity(lower(o.name), lower(:name)) DESC
			LIMIT :limit
			""", nativeQuery = true)
	List<DuplicateCandidateView> findDuplicateCandidates(@Param("name") String name, @Param("domain") String domain,
			@Param("excludeId") UUID excludeId, @Param("threshold") double threshold, @Param("limit") int limit);

	interface DuplicateCandidateView {
		UUID getId();

		String getName();

		String getType();

		String getDomain();

		Instant getArchivedAt();

		Boolean getNameExact();

		Boolean getDomainExact();

		Double getSimilarity();

		Boolean getContains();
	}
}
