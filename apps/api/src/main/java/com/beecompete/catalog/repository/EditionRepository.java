package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Edition;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EditionRepository extends JpaRepository<Edition, UUID> {

	List<Edition> findByCompetitionId(UUID competitionId);
}
