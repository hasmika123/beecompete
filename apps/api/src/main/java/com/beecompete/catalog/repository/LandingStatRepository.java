package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.LandingSlot;
import com.beecompete.catalog.domain.LandingStat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LandingStatRepository extends JpaRepository<LandingStat, UUID> {

	Optional<LandingStat> findByPosition(LandingSlot position);
}
