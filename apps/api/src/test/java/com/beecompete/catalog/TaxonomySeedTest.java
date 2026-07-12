package com.beecompete.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.beecompete.TestcontainersConfiguration;
import com.beecompete.catalog.domain.Category;
import com.beecompete.catalog.repository.CategoryRepository;
import com.beecompete.catalog.repository.CategoryTemplateRepository;
import com.beecompete.catalog.service.CategoryAttributeValidator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/**
 * R1-2: the Liquibase seed (0005) must establish the 11 launch categories (Q1, locked) each with
 * a Category Template, and {@link CategoryAttributeValidator} must enforce a template's JSON
 * Schema against an attributes bag — the D1 "standardized yet flexible" mechanism.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Transactional
class TaxonomySeedTest {

	private static final List<String> LAUNCH_SLUGS = List.of(
			"math",
			"science-engineering",
			"computer-science",
			"robotics",
			"debate-speech",
			"business-entrepreneurship",
			"writing-essay",
			"arts-music",
			"academic-bowl",
			"history-geography-civics",
			"other");

	@Autowired
	private CategoryRepository categories;

	@Autowired
	private CategoryTemplateRepository templates;

	@Autowired
	private CategoryAttributeValidator validator;

	@Test
	void seedsTheElevenLaunchCategoriesEachWithATemplate() {
		for (String slug : LAUNCH_SLUGS) {
			Category category = categories.findBySlug(slug).orElseThrow(
					() -> new AssertionError("missing seeded category: " + slug));
			assertThat(category.getName()).isNotBlank();
			assertThat(category.getParent()).isNull(); // launch set is all top-level
			assertThat(templates.findByCategoryId(category.getId()))
					.as("template for %s", slug)
					.isPresent()
					.get()
					.satisfies(t -> assertThat(t.getJsonSchema()).containsEntry("type", "object"));
		}
	}

	@Test
	void validatesAttributesAgainstTheCategoryTemplate() {
		UUID mathId = categories.findBySlug("math").orElseThrow().getId();

		// Conforming bag → no problems.
		assertThat(validator.validate(mathId,
				Map.of("topics", List.of("algebra", "combinatorics"), "calculator_allowed", false)))
				.isEmpty();

		// Wrong types → schema violations surface.
		assertThat(validator.validate(mathId,
				Map.of("topics", "algebra", "calculator_allowed", "nope")))
				.hasSize(2);

		// Null/empty bag is valid — attributes are optional (D1).
		assertThat(validator.validate(mathId, null)).isEmpty();
		assertThat(validator.validate(mathId, Map.of())).isEmpty();

		// Category without a template (fresh row) → permissive until curated.
		Category uncurated = categories.save(new Category("Chess", "chess"));
		assertThat(validator.validate(uncurated.getId(), Map.of("anything", 1))).isEmpty();
	}
}
