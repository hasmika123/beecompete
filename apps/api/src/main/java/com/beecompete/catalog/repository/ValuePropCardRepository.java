package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.LandingSlot;
import com.beecompete.catalog.domain.ValuePropCard;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ValuePropCardRepository extends JpaRepository<ValuePropCard, UUID> {

	Optional<ValuePropCard> findByPosition(LandingSlot position);
}
