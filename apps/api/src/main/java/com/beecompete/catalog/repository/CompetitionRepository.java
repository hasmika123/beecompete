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

	/** Live catalog size (landing "N more competitions" label, How-It-Works stats). */
	long countByArchivedAtIsNull();

	/**
	 * Lean projection for the XML sitemap (R1-10): just the slug, its category slug, and the
	 * last-modified stamp — no entity hydration for what can be a few hundred rows served on a
	 * cached route. Archived competitions are excluded (D7 — invisible to the public).
	 */
	@Query("select c.slug as slug, cat.slug as categorySlug, c.updatedAt as updatedAt"
			+ " from Competition c join c.category cat where c.archivedAt is null")
	List<SitemapView> findSitemapViews();

	interface SitemapView {
		String getSlug();

		String getCategorySlug();

		Instant getUpdatedAt();
	}
}
