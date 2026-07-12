package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Resource;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ResourceRepository extends JpaRepository<Resource, UUID> {

	List<Resource> findByCompetitionIdOrderByDisplayOrder(UUID competitionId);
}
