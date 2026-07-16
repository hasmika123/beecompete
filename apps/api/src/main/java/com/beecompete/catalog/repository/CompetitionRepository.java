package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Competition;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CompetitionRepository extends JpaRepository<Competition, UUID> {

	Optional<Competition> findBySlug(String slug);

	boolean existsBySlug(String slug);

	/** Admin list search (R1-3) — a plain contains match; the public FTS search is CompetitionSearchService. */
	Page<Competition> findByNameContainingIgnoreCase(String name, Pageable pageable);

	/**
	 * Live catalog size for public labels (landing "N more competitions", How-It-Works stats) —
	 * readiness-gated: only listings with a non-archived edition, matching the browse/search
	 * predicate (domain-model §8a). A competition with no edition is a zombie, never counted.
	 */
	@Query(value = """
			SELECT count(*) FROM competition c
			WHERE c.archived_at IS NULL
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
}
