package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.CategoryTemplate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryTemplateRepository extends JpaRepository<CategoryTemplate, UUID> {

	Optional<CategoryTemplate> findByCategoryId(UUID categoryId);
}
