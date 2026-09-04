package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.domain.ImportStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ImportRecordRepository extends JpaRepository<ImportRecord, UUID>, ImportRecordSearch {

	Page<ImportRecord> findByStatusOrderByCreatedAt(ImportStatus status, Pageable pageable);

	/** Per-tab queue depth for the admin list — how much PENDING work is left, at a glance. */
	long countByStatus(ImportStatus status);

	// --- duplicate detection (DQ4, migration 0026) ---

	/**
	 * Other PENDING records that look like the same competition as the RAW values given — "someone
	 * already queued this". Matched on the generated keys (payload name / officialUrl) and on the
	 * page each record was fetched from. {@code excludeId} is the record being reviewed, or a
	 * sentinel when there is none. Oldest first: the earlier submission is the one to keep.
	 */
	@Query(value = """
			SELECT o.id AS "id", o.payload->>'name' AS "name", o.source_url AS "sourceUrl", o.created_at AS "createdAt",
			  (o.name_key IS NOT NULL AND o.name_key = catalog_name_key(:name)) AS "nameExact",
			  ((o.url_key IS NOT NULL AND o.url_key = catalog_url_key(:url))
			    OR (o.source_url IS NOT NULL AND catalog_url_key(o.source_url) = catalog_url_key(:url))) AS "urlExact"
			FROM import_record o
			WHERE o.status = 'PENDING'
			  AND o.id <> :excludeId
			  AND ((o.name_key IS NOT NULL AND o.name_key = catalog_name_key(:name))
			    OR (o.url_key IS NOT NULL AND o.url_key = catalog_url_key(:url))
			    OR (o.source_url IS NOT NULL AND catalog_url_key(o.source_url) = catalog_url_key(:url)))
			ORDER BY o.created_at
			LIMIT :limit
			""", nativeQuery = true)
	List<PendingTwinView> findPendingTwins(@Param("name") String name, @Param("url") String url,
			@Param("excludeId") UUID excludeId, @Param("limit") int limit);

	/** How many OTHER pending records each of these records has as a twin — one query per queue page. */
	@Query(value = """
			SELECT r.id AS "recordId", count(o.id) AS "twins"
			FROM import_record r
			  JOIN import_record o
			    ON o.id <> r.id AND o.status = 'PENDING'
			    AND ((r.name_key IS NOT NULL AND o.name_key = r.name_key)
			      OR (r.url_key IS NOT NULL AND o.url_key = r.url_key)
			      OR (r.source_url IS NOT NULL AND catalog_url_key(o.source_url) = catalog_url_key(r.source_url)))
			WHERE r.id IN (:ids)
			GROUP BY r.id
			""", nativeQuery = true)
	List<PendingTwinCountView> countPendingTwins(@Param("ids") Collection<UUID> ids);

	interface PendingTwinView {
		UUID getId();

		String getName();

		String getSourceUrl();

		Instant getCreatedAt();

		Boolean getNameExact();

		Boolean getUrlExact();
	}

	interface PendingTwinCountView {
		UUID getRecordId();

		Long getTwins();
	}
}
