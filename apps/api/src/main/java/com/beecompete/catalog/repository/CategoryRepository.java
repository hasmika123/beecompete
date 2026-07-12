package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Category;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

	Optional<Category> findBySlug(String slug);
}
