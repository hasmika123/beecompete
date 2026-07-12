package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.CompetitionFaq;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompetitionFaqRepository extends JpaRepository<CompetitionFaq, UUID> {

	List<CompetitionFaq> findByCompetitionIdOrderByDisplayOrder(UUID competitionId);
}
