package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Organization;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

	/** Curation dedup: the import pipeline looks orgs up by name before creating one. */
	Optional<Organization> findByNameIgnoreCase(String name);

	Page<Organization> findByNameContainingIgnoreCase(String name, Pageable pageable);
}
