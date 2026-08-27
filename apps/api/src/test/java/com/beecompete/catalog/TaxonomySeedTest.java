package com.beecompete.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.beecompete.TestcontainersConfiguration;
import com.beecompete.catalog.domain.Category;
import com.beecompete.catalog.domain.CategoryTemplate;
import com.beecompete.catalog.repository.CategoryRepository;
import com.beecompete.catalog.repository.CategoryTemplateRepository;
import com.beecompete.catalog.service.CategoryAttributeValidator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

	/**
	 * The template key set, pinned. This is the CI-side half of the seeding tool's drift problem.
	 *
	 * <p>`tools/seeding/src/categories.ts` is a hand-maintained copy of what these changesets did,
	 * and it is what the extraction prompt is generated from. It fell three changesets behind
	 * (`0015` judging, `0017` eligibility catch-all, `0019` contact) and nothing noticed: templates
	 * carry {@code additionalProperties: true}, so a key the copy doesn't know about is
	 * indistinguishable from "the source page didn't mention it". Six keys went unextracted for
	 * months.
	 *
	 * <p>This test runs against a container that has executed every migration, so it fails the
	 * moment a changeset adds or drops a template key — with a message naming the file to update.
	 * It is deliberately a DUMB LIST: its whole value is that a human must edit it, notice the
	 * second file, and update both. Do not make it derive the expectation from the schema.
	 *
	 * <p>It cannot catch a template edited through the admin UI at runtime — nothing in CI can.
	 * The seeding tool handles that case by fetching templates from the API at run time and
	 * warning when they disagree with its copy.
	 */
	@Test
	void everyTemplateCarriesExactlyTheExpectedKeys() {
		// Universal keys: 0005 seed + 0015 + 0017 + 0019, retyped by 0022.
		Set<String> universal = Set.of(
				"eligible_countries", "citizenship_countries", "student_status_required",
				"other_eligibility_requirements", "syllabus", "topics",
				"judging_criteria", "tie_breakers", "rules_url",
				"contact_email", "contact_phone");

		Map<String, Set<String>> categorySpecific = Map.ofEntries(
				Map.entry("math", Set.of("calculator_allowed", "proof_based")),
				Map.entry("science-engineering", Set.of("isef_affiliated", "fair_levels", "project_categories")),
				Map.entry("computer-science", Set.of("languages", "submission_platform")),
				Map.entry("robotics", Set.of("league", "kit_platform", "game_title")),
				Map.entry("debate-speech", Set.of("debate_formats", "speech_events")),
				Map.entry("business-entrepreneurship", Set.of("ctso", "event_categories")),
				Map.entry("writing-essay", Set.of("genres", "word_limit")),
				Map.entry("arts-music", Set.of("disciplines", "media_types")),
				Map.entry("academic-bowl", Set.of("quiz_format", "subjects_covered")),
				Map.entry("history-geography-civics", Set.of("focus_areas")),
				Map.entry("other", Set.of()));

		for (Map.Entry<String, Set<String>> entry : categorySpecific.entrySet()) {
			String slug = entry.getKey();
			UUID categoryId = categories.findBySlug(slug).orElseThrow().getId();
			CategoryTemplate template = templates.findByCategoryId(categoryId).orElseThrow();

			@SuppressWarnings("unchecked")
			Map<String, Object> properties =
					(Map<String, Object>) template.getJsonSchema().get("properties");

			Set<String> expected = new HashSet<>(universal);
			expected.addAll(entry.getValue());

			assertThat(properties.keySet())
					.as("template keys for %s changed — update tools/seeding/src/categories.ts "
							+ "(the extraction prompt is generated from it; a key missing there is "
							+ "silently never extracted) and then this expectation", slug)
					.containsExactlyInAnyOrderElementsOf(expected);
		}
	}

	/**
	 * `student_status_required` is a BOOLEAN on every template since changelog `0022` (owner
	 * 2026-08-26) — it was free text until then. Pinned because the type is what makes the admin
	 * render a checkbox instead of a 300-char box, and because a regression would be silent:
	 * templates carry {@code additionalProperties: true}, so a re-typed key does not fail loudly,
	 * it just starts accepting sentences again.
	 */
	@Test
	void studentStatusRequiredIsBooleanOnEveryTemplate() {
		for (String slug : List.of("math", "science-engineering", "debate-speech", "other")) {
			UUID categoryId = categories.findBySlug(slug).orElseThrow().getId();

			assertThat(validator.validate(categoryId, Map.of("student_status_required", true)))
					.as("boolean accepted for %s", slug)
					.isEmpty();

			assertThat(validator.validate(categoryId,
					Map.of("student_status_required", "enrolled full-time in a U.S. high school")))
					.as("prose rejected for %s — it belongs in other_eligibility_requirements", slug)
					.isNotEmpty();
		}

		// The prose that used to live in the key has a typed home of its own (0017) — a sentence
		// there stays valid, which is what makes the 0022 split workable.
		UUID mathId = categories.findBySlug("math").orElseThrow().getId();
		assertThat(validator.validate(mathId, Map.of(
				"student_status_required", true,
				"other_eligibility_requirements", "Must be enrolled full-time in grades 9-12.")))
				.isEmpty();
	}
}
