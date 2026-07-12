package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Competition;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompetitionRepository extends JpaRepository<Competition, UUID> {

	Optional<Competition> findBySlug(String slug);

	boolean existsBySlug(String slug);

	/** Admin list search (R1-3) — a plain contains match; the public FTS search is CompetitionSearchService. */
	Page<Competition> findByNameContainingIgnoreCase(String name, Pageable pageable);

	/** Live catalog size (landing "N more competitions" label, How-It-Works stats). */
	long countByArchivedAtIsNull();
}
