package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.HeroCard;
import com.beecompete.catalog.domain.HeroCardPosition;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeroCardRepository extends JpaRepository<HeroCard, UUID> {

	Optional<HeroCard> findByPosition(HeroCardPosition position);
}
