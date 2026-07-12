package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Region;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegionRepository extends JpaRepository<Region, UUID> {

	/** Public region filter (R1-5) — codes are URL-friendly but not unique, so this returns all matches. */
	List<Region> findByCodeIgnoreCase(String code);
}
