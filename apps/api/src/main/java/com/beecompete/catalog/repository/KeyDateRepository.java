package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.KeyDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KeyDateRepository extends JpaRepository<KeyDate, UUID> {

	List<KeyDate> findByEditionIdOrderByStartsAt(UUID editionId);
}
