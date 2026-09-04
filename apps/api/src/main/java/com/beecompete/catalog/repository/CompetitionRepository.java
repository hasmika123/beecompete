package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.ListingStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompetitionRepository extends JpaRepository<Competition, UUID> {

	Optional<Competition> findBySlug(String slug);

	boolean existsBySlug(String slug);

	/** Admin list search (R1-3) — a plain contains match; the public FTS search is CompetitionSearchService. */
	Page<Competition> findByNameContainingIgnoreCase(String name, Pageable pageable);

	/** Admin list filtered to one lifecycle state (§8a) — the review queue reads IN_REVIEW. Archived rows excluded: they have no lifecycle to act on. */
	Page<Competition> findByListingStatusAndNameContainingIgnoreCaseAndArchivedAtIsNull(
			ListingStatus listingStatus, String name, Pageable pageable);

	/**
	 * Admin list, filtered to ZOMBIE listings: not archived, yet no non-archived edition — so the
	 * readiness gate (&sect;8a) hides them from the public catalog unintentionally. Archived rows
	 * are excluded: they are hidden on purpose, and listing them here would bury real zombies. Same EXISTS predicate as
	 * {@link #countPublicListings()} and the search gate, negated — one rule for "is this
	 * browsable", never two that can drift.
	 */
	@Query("""
			SELECT c FROM Competition c
			WHERE lower(c.name) LIKE lower(concat('%', :name, '%'))
			  AND c.archivedAt IS NULL
			  AND NOT EXISTS (
			    SELECT 1 FROM Edition e WHERE e.competition = c AND e.archivedAt IS NULL)
			""")
	Page<Competition> findMissingLiveEdition(@Param("name") String name, Pageable pageable);

	/**
	 * Which of these ids have a live edition — one query per admin page, not one per row (same
	 * reasoning as {@link #findBySlugIn(Collection)}). Drives the "no edition" badge.
	 */
	@Query("""
			SELECT c.id FROM Competition c
			WHERE c.id IN :ids
			  AND EXISTS (SELECT 1 FROM Edition e WHERE e.competition = c AND e.archivedAt IS NULL)
			""")
	List<UUID> idsWithLiveEdition(@Param("ids") Collection<UUID> ids);

	/**
	 * Bulk slug lookup for the import queue's duplicate flag (one query per page, not one per row).
	 * Archived listings are INCLUDED deliberately: a slug is permanent (D7 keeps it on archive), so
	 * approving over one still collides — the curator needs to see it.
	 */
	List<Competition> findBySlugIn(Collection<String> slugs);

	/**
	 * Live catalog size for public labels (landing "N more competitions", How-It-Works stats) —
	 * readiness-gated: only listings with a non-archived edition, matching the browse/search
	 * predicate (domain-model §8a). A competition with no edition is a zombie, never counted.
	 */
	@Query(value = """
			SELECT count(*) FROM competition c
			WHERE c.archived_at IS NULL
			  AND c.listing_status = 'PUBLISHED'
			  AND EXISTS (SELECT 1 FROM edition e WHERE e.competition_id = c.id AND e.archived_at IS NULL)
			""", nativeQuery = true)
	long countPublicListings();

	/**
	 * Lean projection for the XML sitemap (R1-10): slug, category slug, and an HONEST last-modified
	 * stamp = the greatest of the competition row and its children's {@code updated_at} (editions,
	 * resources, FAQs). A detail page's volatile content lives in those child tables, so the
	 * parent row alone under-reports change (review M5). KeyDates have no {@code updated_at}, so
	 * their writes bump the parent Edition's stamp instead (see EditionAdminController). Postgres
	 * {@code GREATEST} ignores NULLs, so childless competitions fall back to their own stamp.
	 * Archived competitions are excluded (D7). No entity hydration — a few hundred rows on a
	 * cached route. (Scale note: fine to ~10-20k; past Google's 50k-URL sitemap limit the web
	 * side needs a sitemap index + this query needs paging.)
	 */
	@Query(value = """
			SELECT c.slug AS "slug", cat.slug AS "categorySlug",
			  GREATEST(c.updated_at, MAX(e.updated_at), MAX(r.updated_at), MAX(f.updated_at))
			    AS "updatedAt"
			FROM competition c
			  JOIN category cat ON cat.id = c.category_id
			  LEFT JOIN edition e ON e.competition_id = c.id AND e.archived_at IS NULL
			  LEFT JOIN resource r ON r.competition_id = c.id
			  LEFT JOIN competition_faq f ON f.competition_id = c.id
			WHERE c.archived_at IS NULL
			  AND c.listing_status = 'PUBLISHED'
			  AND EXISTS (SELECT 1 FROM edition le
			    WHERE le.competition_id = c.id AND le.archived_at IS NULL)
			GROUP BY c.id, c.slug, cat.slug, c.updated_at
			""", nativeQuery = true)
	List<SitemapView> findSitemapViews();

	interface SitemapView {
		String getSlug();

		String getCategorySlug();

		Instant getUpdatedAt();
	}

	// --- duplicate detection (DQ4, migration 0026; the reasons are assembled in DuplicateDetectionService) ---

	/**
	 * Candidates for a competition described by RAW values. The database keys the parameters with
	 * the same {@code catalog_name_key} / {@code catalog_url_key} that keyed the stored rows —
	 * Java never normalizes, so the two sides cannot drift. Blank parameters key to NULL and match
	 * nothing; {@code excludeId} is a sentinel UUID when there is nothing to exclude (a NULL would
	 * void the whole predicate). Similarity is whole-string {@code pg_trgm}; containment is on the
	 * name keys and only once the shorter key is long enough that "Bee" stops matching every bee.
	 * Archived rows are INCLUDED: an archived exact match is a signal the caller weighs.
	 */
	@Query(value = """
			SELECT c.id AS "id", c.slug AS "slug", c.name AS "name", o.name AS "organizerName",
			  c.listing_status AS "listingStatus", c.archived_at AS "archivedAt",
			  (c.name_key = catalog_name_key(:name)) AS "nameExact",
			  (c.url_key IS NOT NULL AND c.url_key = catalog_url_key(:url)) AS "urlExact",
			  (c.slug = :slug) AS "slugTaken",
			  CAST(similarity(lower(c.name), lower(:name)) AS double precision) AS "similarity",
			  (length(catalog_name_key(:name)) >= 10 AND length(c.name_key) >= 10
			    AND (c.name_key LIKE '%' || catalog_name_key(:name) || '%'
			      OR catalog_name_key(:name) LIKE '%' || c.name_key || '%')) AS "contains"
			FROM competition c
			  JOIN organization o ON o.id = c.organizer_org_id
			WHERE c.id <> :excludeId
			  AND (c.name_key = catalog_name_key(:name)
			    OR (c.url_key IS NOT NULL AND c.url_key = catalog_url_key(:url))
			    OR c.slug = :slug
			    OR similarity(lower(c.name), lower(:name)) >= :threshold
			    OR (length(catalog_name_key(:name)) >= 10 AND length(c.name_key) >= 10
			      AND (c.name_key LIKE '%' || catalog_name_key(:name) || '%'
			        OR catalog_name_key(:name) LIKE '%' || c.name_key || '%')))
			ORDER BY (c.archived_at IS NULL AND c.name_key = catalog_name_key(:name)) DESC,
			  (c.name_key = catalog_name_key(:name)) DESC,
			  (c.url_key IS NOT NULL AND c.url_key = catalog_url_key(:url)) DESC,
			  similarity(lower(c.name), lower(:name)) DESC
			LIMIT :limit
			""", nativeQuery = true)
	List<DuplicateCandidateView> findDuplicateCandidates(@Param("name") String name, @Param("url") String url,
			@Param("slug") String slug, @Param("excludeId") UUID excludeId, @Param("threshold") double threshold,
			@Param("limit") int limit);

	/**
	 * The cheap signals for a PAGE of import records, joined on the generated keys of both tables
	 * (one query per page, never one per row): same name key, same URL key — the payload's
	 * officialUrl or the page actually fetched — or the payload's slug already taken. No trigram
	 * work: the list is scanned, the review page is read.
	 */
	@Query(value = """
			SELECT r.id AS "recordId", c.id AS "id", c.slug AS "slug", c.name AS "name", o.name AS "organizerName",
			  c.listing_status AS "listingStatus", c.archived_at AS "archivedAt",
			  (c.name_key = r.name_key) AS "nameExact",
			  (c.url_key IS NOT NULL AND (c.url_key = r.url_key OR c.url_key = catalog_url_key(r.source_url))) AS "urlExact",
			  (c.slug = r.payload->>'slug') AS "slugTaken",
			  CAST(NULL AS double precision) AS "similarity",
			  false AS "contains"
			FROM import_record r
			  JOIN competition c
			    ON c.name_key = r.name_key
			    OR (c.url_key IS NOT NULL AND (c.url_key = r.url_key OR c.url_key = catalog_url_key(r.source_url)))
			    OR c.slug = r.payload->>'slug'
			  JOIN organization o ON o.id = c.organizer_org_id
			WHERE r.id IN (:ids)
			""", nativeQuery = true)
	List<RecordCollisionView> findCollisionsForImportRecords(@Param("ids") Collection<UUID> ids);

	/** The boolean signals every candidate row carries; the service turns them into match reasons. */
	interface CandidateSignals {
		UUID getId();

		String getSlug();

		String getName();

		String getOrganizerName();

		String getListingStatus();

		Instant getArchivedAt();

		Boolean getNameExact();

		Boolean getUrlExact();

		Boolean getSlugTaken();

		Double getSimilarity();

		Boolean getContains();
	}

	interface DuplicateCandidateView extends CandidateSignals {}

	interface RecordCollisionView extends CandidateSignals {
		UUID getRecordId();
	}
}
