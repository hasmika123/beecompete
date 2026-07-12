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

	/** Admin list search (R1-3). Real FTS search is R1-5 — this is a plain contains match. */
	Page<Competition> findByNameContainingIgnoreCase(String name, Pageable pageable);

	/** Public catalog list (R1-4): live listings only — archived records keep their slug but vanish (D7). */
	Page<Competition> findByArchivedAtIsNull(Pageable pageable);
}
