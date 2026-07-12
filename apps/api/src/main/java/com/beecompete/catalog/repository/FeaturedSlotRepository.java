package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.FeaturedSlot;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeaturedSlotRepository extends JpaRepository<FeaturedSlot, UUID> {

	List<FeaturedSlot> findAllByOrderByPosition();
}
