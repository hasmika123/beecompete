package com.beecompete.catalog.web;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.beecompete.TestcontainersConfiguration;
import com.beecompete.platform.web.AdminTokenFilter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * R1-5 search & filter on real Postgres (FTS + pg_trgm are engine features — no H2). Every
 * seed carries the marker token "r15seed" in its summary so assertions stay isolated from the
 * other integration classes' data (shared Spring context + database). Seeds:
 *
 * <pre>
 * algebra   math      grades 3–8   FREE  VIRTUAL    INDIVIDUAL  INDIVIDUAL pathway  [exam]        deadline +10d
 * robotics  sci-eng   grades 6–12  PAID  IN_PERSON  TEAM        SCHOOL_OR_CHAPTER   [live_perf.]  deadline +60d, region TX
 * essay     comp-sci  all grades   FREE  HYBRID     BOTH        EITHER              [submission,portfolio]  no editions
 * archived  math      —            (archived — must never appear)
 * </pre>
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "admin.api-token=test-admin-token")
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class CatalogSearchIntegrationTest {

	private static final String MARK = "r15seed";
	private static boolean seeded;

	@Autowired
	private MockMvc mvc;

	@Autowired
	private ObjectMapper mapper;

	private MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder builder) {
		return builder.header(AdminTokenFilter.HEADER, "test-admin-token");
	}

	@Test
	@Order(1)
	void keywordSearchMatchesTextAndToleratesTypos() throws Exception {
		seed();

		// The marker token reaches all three live seeds via FTS on the summary; archived is out.
		List<String> all = slugs("/api/v1/competitions?q=" + MARK + "&size=50");
		org.junit.jupiter.api.Assertions.assertEquals(
				List.of("r15-algebra-open", "r15-essay-prize", "r15-robotics-league"),
				all.stream().sorted().toList());

		// Multi-word FTS across name + description.
		org.junit.jupiter.api.Assertions.assertTrue(
				slugs("/api/v1/competitions?q=algebra%20contest&size=50").contains("r15-algebra-open"));

		// Typo tolerance via pg_trgm word similarity ("algebr" has no FTS hit as a lexeme prefix).
		org.junit.jupiter.api.Assertions.assertTrue(
				slugs("/api/v1/competitions?q=algebr&size=50").contains("r15-algebra-open"));
	}

	@Test
	@Order(2)
	void facetFiltersNarrowTheSet() throws Exception {
		assertSlugs("category=math", "r15-algebra-open");
		assertSlugs("minGrade=9&maxGrade=9", "r15-essay-prize", "r15-robotics-league"); // null grades = open
		assertSlugs("cost=free", "r15-algebra-open", "r15-essay-prize");
		assertSlugs("delivery=in_person", "r15-robotics-league");
		// Eligibility semantics: "individual" includes BOTH / EITHER records.
		assertSlugs("participation=individual", "r15-algebra-open", "r15-essay-prize");
		assertSlugs("pathway=individual", "r15-algebra-open", "r15-essay-prize");
		assertSlugs("evaluation=portfolio", "r15-essay-prize");
		assertSlugs("region=tx", "r15-robotics-league"); // by code, case-insensitive
		assertSlugs("deadlineWithinDays=30", "r15-algebra-open");
		// Unknown filter VALUE = empty result, not an error.
		assertSlugs("category=no-such-category" /* nothing */);
	}

	@Test
	@Order(3)
	void sortsOrderTheFeed() throws Exception {
		// deadline: soonest first, no-deadline last.
		org.junit.jupiter.api.Assertions.assertEquals(
				List.of("r15-algebra-open", "r15-robotics-league", "r15-essay-prize"),
				slugs("/api/v1/competitions?q=" + MARK + "&sort=deadline&size=50"));
		// newest: last-created seed first.
		org.junit.jupiter.api.Assertions.assertEquals("r15-essay-prize",
				slugs("/api/v1/competitions?q=" + MARK + "&sort=newest&size=50").get(0));
		// The card facts ride along on every item: deadline, prize line, region names.
		mvc.perform(get("/api/v1/competitions?q=" + MARK + "&sort=deadline&size=50"))
				.andExpect(jsonPath("$.content[0].nextDeadline").isNotEmpty())
				.andExpect(jsonPath("$.content[0].prizeSummary", is("Champion trophy")))
				.andExpect(jsonPath("$.content[2].nextDeadline").isEmpty())
				.andExpect(jsonPath("$.content[2].prizeSummary").isEmpty())
				.andExpect(jsonPath("$.content[2].regions", hasSize(0)));
		mvc.perform(get("/api/v1/competitions?q=" + MARK + "&region=tx"))
				.andExpect(jsonPath("$.content[0].regions[0]", is("Texas")));
		// The public region options (filter panel source) carry live counts.
		mvc.perform(get("/api/v1/regions"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.code=='TX')].count", is(java.util.List.of(1))))
				.andExpect(jsonPath("$[?(@.code=='TX')].level", is(java.util.List.of("state"))));
	}

	@Test
	@Order(4)
	void facetCountsExcludeTheirOwnDimension() throws Exception {
		mvc.perform(get("/api/v1/competitions?q=" + MARK + "&facets=true&size=50"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.facets.categories", hasSize(3)))
				.andExpect(jsonPath("$.facets.categories[?(@.slug=='math')].count", is(List.of(1))))
				// grade 7 is inside all three ranges (3–8, 6–12, open).
				.andExpect(jsonPath("$.facets.grades[?(@.grade==7)].count", is(List.of(3))));

		// With category=math active, the category facet still shows the alternatives…
		mvc.perform(get("/api/v1/competitions?q=" + MARK + "&category=math&facets=true&size=50"))
				.andExpect(jsonPath("$.facets.categories", hasSize(3)))
				// …while the grade facet DOES apply the category filter (grade 9 is outside 3–8).
				.andExpect(jsonPath("$.facets.grades[?(@.grade==7)].count", is(List.of(1))))
				.andExpect(jsonPath("$.facets.grades[?(@.grade==9)]", hasSize(0)));
	}

	@Test
	@Order(5)
	void publicCategoriesAndLandingContentServeTheStaticPages() throws Exception {
		// All 11 seeded categories, with live counts (R1-6b Categories index / hero strip).
		mvc.perform(get("/api/v1/categories"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(11)))
				.andExpect(jsonPath("$[?(@.slug=='math' && @.count >= 1)]", hasSize(1)));

		// Landing content: admin sets a hero card + featured pick; the public read carries both.
		String amc = slugs("/api/v1/competitions?q=" + MARK + "&category=math&size=1").get(0);
		String compId = mvc.perform(get("/api/v1/competitions/" + amc))
				.andReturn().getResponse().getContentAsString();
		String id = mapper.readTree(compId).get("id").asText();
		mvc.perform(withToken(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
						.put("/api/v1/admin/hero-cards/MAIN")).contentType("application/json")
						.content("""
								{"imageKey": "hero/main.jpg", "altText": "Students competing",
								 "linkUrl": "/competitions", "description": "Browse the catalog"}
								"""))
				.andExpect(status().isOk());
		mvc.perform(withToken(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
						.put("/api/v1/admin/featured-slots")).contentType("application/json")
						.content("{\"competitionIds\": [\"" + id + "\"]}"))
				.andExpect(status().isOk());

		mvc.perform(get("/api/v1/landing"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.heroCards[0].position", is("main")))
				.andExpect(jsonPath("$.heroCards[0].description", is("Browse the catalog")))
				.andExpect(jsonPath("$.featured", hasSize(1)))
				.andExpect(jsonPath("$.featured[0].slug", is("r15-algebra-open")))
				.andExpect(jsonPath("$.featured[0].prizeSummary", is("Champion trophy")))
				.andExpect(jsonPath("$.totalCompetitions",
						org.hamcrest.Matchers.greaterThanOrEqualTo(3)));
	}

	@Test
	@Order(6)
	void badTokensAre400AndWriteValidationEnforcesEvaluationTypes() throws Exception {
		mvc.perform(get("/api/v1/competitions?cost=cheap")).andExpect(status().isBadRequest());
		mvc.perform(get("/api/v1/competitions?participation=both")).andExpect(status().isBadRequest());
		mvc.perform(get("/api/v1/competitions?evaluation=quiz")).andExpect(status().isBadRequest());
		mvc.perform(get("/api/v1/competitions?sort=popularity")).andExpect(status().isBadRequest());

		// The write boundary rejects non-canonical evaluation tokens (422, naming the allowed set).
		String body = competitionJson("r15-bad-eval", "Bad Eval r15", categoryId("math"))
				.replace("\"evaluationType\": []", "\"evaluationType\": [\"quiz\"]");
		mvc.perform(withToken(post("/api/v1/admin/competitions")).contentType("application/json")
						.content(body))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.message",
						org.hamcrest.Matchers.containsString("unknown evaluation type")));
	}

	// --- helpers ---

	private void assertSlugs(String filterQuery, String... expected) throws Exception {
		List<String> actual =
				slugs("/api/v1/competitions?q=" + MARK + "&" + filterQuery + "&size=50");
		org.junit.jupiter.api.Assertions.assertEquals(
				List.of(expected).stream().sorted().toList(), actual.stream().sorted().toList(),
				"filter: " + filterQuery);
	}

	private List<String> slugs(String url) throws Exception {
		String json = mvc.perform(get(url)).andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		List<String> result = new ArrayList<>();
		for (JsonNode item : mapper.readTree(json).get("content")) {
			result.add(item.get("slug").asText());
		}
		return result;
	}

	private String categoryId(String slug) throws Exception {
		String categories = mvc.perform(withToken(get("/api/v1/admin/categories")))
				.andReturn().getResponse().getContentAsString();
		for (JsonNode node : mapper.readTree(categories)) {
			if (slug.equals(node.get("slug").asText())) {
				return node.get("id").asText();
			}
		}
		throw new AssertionError("seeded category missing: " + slug);
	}

	private String competitionJson(String slug, String name, String catId) {
		return """
				{"slug": "%s", "name": "%s", "categoryId": "%s", "summary": "%s",
				 "participationMode": "INDIVIDUAL", "delivery": "VIRTUAL", "entryPathway": "INDIVIDUAL",
				 "costType": "FREE", "recurrence": "ANNUAL", "evaluationType": []}
				""".formatted(slug, name, catId, MARK);
	}

	private void seed() throws Exception {
		if (seeded) {
			return;
		}
		seeded = true;
		String math = categoryId("math");
		String sciEng = categoryId("science-engineering");
		String compSci = categoryId("computer-science");
		Instant now = Instant.now();

		String algebra = createCompetition("""
				{"slug": "r15-algebra-open", "name": "Algebra Open r15", "categoryId": "%s",
				 "summary": "A friendly algebra contest — %s", "description": "Algebra problem solving contest.",
				 "minGrade": 3, "maxGrade": 8, "participationMode": "INDIVIDUAL", "delivery": "VIRTUAL",
				 "entryPathway": "INDIVIDUAL", "costType": "FREE", "recurrence": "ANNUAL",
				 "evaluationType": ["exam"]}
				""".formatted(math, MARK));
		String algebraEdition = createEdition(algebra);
		addRegClose(algebraEdition, now.plus(10, ChronoUnit.DAYS));

		String robotics = createCompetition("""
				{"slug": "r15-robotics-league", "name": "Robotics League r15", "categoryId": "%s",
				 "summary": "Build-season league — %s", "minGrade": 6, "maxGrade": 12,
				 "participationMode": "TEAM", "delivery": "IN_PERSON", "entryPathway": "SCHOOL_OR_CHAPTER",
				 "costType": "PAID", "recurrence": "ANNUAL", "evaluationType": ["live_performance"]}
				""".formatted(sciEng, MARK));
		String roboticsEdition = createEdition(robotics);
		addRegClose(roboticsEdition, now.plus(60, ChronoUnit.DAYS));
		String texas = mapper.readTree(mvc.perform(withToken(post("/api/v1/admin/regions"))
						.contentType("application/json")
						.content("{\"level\": \"STATE\", \"name\": \"Texas\", \"code\": \"TX\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString()).get("id").asText();
		mvc.perform(withToken(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
						.put("/api/v1/admin/editions/" + roboticsEdition + "/regions"))
						.contentType("application/json").content("{\"regionIds\": [\"" + texas + "\"]}"))
				.andExpect(status().isOk());

		createCompetition("""
				{"slug": "r15-essay-prize", "name": "Essay Prize r15", "categoryId": "%s",
				 "summary": "Open essay prize — %s", "participationMode": "BOTH", "delivery": "HYBRID",
				 "entryPathway": "EITHER", "costType": "FREE", "recurrence": "ANNUAL",
				 "evaluationType": ["submission", "portfolio"]}
				""".formatted(compSci, MARK));

		String archived = createCompetition("""
				{"slug": "r15-archived", "name": "Archived r15", "categoryId": "%s", "summary": "%s",
				 "participationMode": "INDIVIDUAL", "delivery": "VIRTUAL", "entryPathway": "INDIVIDUAL",
				 "costType": "FREE", "recurrence": "ANNUAL"}
				""".formatted(math, MARK));
		mvc.perform(withToken(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
						.delete("/api/v1/admin/competitions/" + archived)))
				.andExpect(status().isOk());
	}

	private String createCompetition(String body) throws Exception {
		String json = mvc.perform(withToken(post("/api/v1/admin/competitions"))
						.contentType("application/json").content(body))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return mapper.readTree(json).get("id").asText();
	}

	private String createEdition(String competitionId) throws Exception {
		String json = mvc.perform(withToken(post("/api/v1/admin/competitions/" + competitionId + "/editions"))
						.contentType("application/json")
						.content("""
								{"cycleLabel": "2026", "status": "OPEN", "scopeLevel": "NATIONAL",
								 "prizeSummary": "Champion trophy"}
								"""))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return mapper.readTree(json).get("id").asText();
	}

	private void addRegClose(String editionId, Instant startsAt) throws Exception {
		mvc.perform(withToken(post("/api/v1/admin/editions/" + editionId + "/key-dates"))
						.contentType("application/json")
						.content("{\"type\": \"REG_CLOSE\", \"startsAt\": \"%s\"}".formatted(startsAt)))
				.andExpect(status().isCreated());
	}
}
