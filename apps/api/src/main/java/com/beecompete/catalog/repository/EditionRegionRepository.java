package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.EditionRegion;
import com.beecompete.catalog.domain.EditionRegionId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EditionRegionRepository extends JpaRepository<EditionRegion, EditionRegionId> {

	List<EditionRegion> findByEditionId(UUID editionId);
}
