package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Competition;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompetitionRepository extends JpaRepository<Competition, UUID> {

	Optional<Competition> findBySlug(String slug);

	boolean existsBySlug(String slug);
}
