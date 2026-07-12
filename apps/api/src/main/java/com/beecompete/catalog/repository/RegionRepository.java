package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Region;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegionRepository extends JpaRepository<Region, UUID> {
}
