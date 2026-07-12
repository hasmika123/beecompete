package com.beecompete.catalog.curation;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.beecompete.TestcontainersConfiguration;
import com.beecompete.platform.web.AdminTokenFilter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
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
 * R1-3 admin API end-to-end on real Postgres (Testcontainers): token gate (fail-closed),
 * the full curation flow (org → competition → edition → key date → region tag → faq →
 * resource → verification → archive), landing content, and the import queue (approve creates
 * the Competition with provenance=import; reject discards). Uses the seeded R1-2 taxonomy.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "admin.api-token=test-admin-token")
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AdminApiIntegrationTest {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private ObjectMapper mapper;

	private MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder builder) {
		return builder.header(AdminTokenFilter.HEADER, "test-admin-token");
	}

	@Test
	@Order(1)
	void rejectsAdminCallsWithoutOrWithWrongToken() throws Exception {
		mvc.perform(get("/api/v1/admin/categories")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/admin/categories").header(AdminTokenFilter.HEADER, "wrong"))
				.andExpect(status().isUnauthorized());
		// Non-admin routes are untouched by the filter.
		mvc.perform(get("/api/v1/ping")).andExpect(status().isOk());
	}

	@Test
	@Order(2)
	void runsTheFullCurationFlow() throws Exception {
		// Seeded taxonomy is visible.
		String categories = mvc.perform(withToken(get("/api/v1/admin/categories")))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		String mathId = findBySlug(categories, "math");

		// Organization for attribution (DQ13 — the org carries the seal).
		String orgJson = mvc.perform(withToken(post("/api/v1/admin/organizations"))
						.contentType("application/json")
						.content("""
								{"name": "Mathematical Association of America", "type": "HOST", "domain": "maa.org"}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.verificationState", is("UNVERIFIED")))
				.andReturn().getResponse().getContentAsString();
		String orgId = mapper.readTree(orgJson).get("id").asText();

		mvc.perform(withToken(put("/api/v1/admin/organizations/" + orgId + "/verification"))
						.contentType("application/json").content("{\"state\": \"VERIFIED\"}"))
				.andExpect(jsonPath("$.verificationState", is("VERIFIED")));

		// Competition — attributes bag must satisfy the math template.
		String badAttributes = """
				{"slug": "amc-10", "name": "AMC 10", "categoryId": "%s", "organizerOrgId": "%s",
				 "participationMode": "INDIVIDUAL", "delivery": "IN_PERSON", "entryPathway": "SCHOOL_OR_CHAPTER",
				 "costType": "PAID", "recurrence": "ANNUAL", "attributes": {"topics": "not-an-array"}}
				""".formatted(mathId, orgId);
		mvc.perform(withToken(post("/api/v1/admin/competitions")).contentType("application/json")
						.content(badAttributes))
				.andExpect(status().isUnprocessableEntity());

		String goodCompetition = """
				{"slug": "amc-10", "name": "AMC 10", "categoryId": "%s", "organizerOrgId": "%s",
				 "summary": "The classic 25-question contest.", "minGrade": 9, "maxGrade": 10,
				 "participationMode": "INDIVIDUAL", "delivery": "IN_PERSON", "entryPathway": "SCHOOL_OR_CHAPTER",
				 "costType": "PAID", "recurrence": "ANNUAL",
				 "attributes": {"topics": ["algebra"], "calculator_allowed": false}}
				""".formatted(mathId, orgId);
		String compJson = mvc.perform(withToken(post("/api/v1/admin/competitions"))
						.contentType("application/json").content(goodCompetition))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.provenanceSource", is("CURATED"))) // admin write stamps provenance
				.andExpect(jsonPath("$.provenanceLastVerifiedAt", notNullValue()))
				.andReturn().getResponse().getContentAsString();
		String compId = mapper.readTree(compJson).get("id").asText();

		// Duplicate slug → 409.
		mvc.perform(withToken(post("/api/v1/admin/competitions")).contentType("application/json")
						.content(goodCompetition))
				.andExpect(status().isConflict());

		// Edition + key date + region tag.
		String editionJson = mvc.perform(withToken(post("/api/v1/admin/competitions/" + compId + "/editions"))
						.contentType("application/json")
						.content("""
								{"cycleLabel": "2026", "status": "UPCOMING", "scopeLevel": "NATIONAL",
								 "entryFee": 2.50, "currency": "USD", "prizeSummary": "AIME invite"}
								"""))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String editionId = mapper.readTree(editionJson).get("id").asText();

		mvc.perform(withToken(post("/api/v1/admin/editions/" + editionId + "/key-dates"))
						.contentType("application/json")
						.content("""
								{"type": "REG_CLOSE", "startsAt": "2026-10-15T23:59:00Z", "timezone": "America/New_York"}
								"""))
				.andExpect(status().isCreated());

		String regionJson = mvc.perform(withToken(post("/api/v1/admin/regions"))
						.contentType("application/json")
						.content("{\"level\": \"COUNTRY\", \"name\": \"United States\", \"code\": \"US\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String regionId = mapper.readTree(regionJson).get("id").asText();

		mvc.perform(withToken(put("/api/v1/admin/editions/" + editionId + "/regions"))
						.contentType("application/json")
						.content("{\"regionIds\": [\"" + regionId + "\"]}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)));

		// FAQ + resource children.
		mvc.perform(withToken(post("/api/v1/admin/competitions/" + compId + "/faqs"))
						.contentType("application/json")
						.content("""
								{"question": "Can homeschoolers enter?", "answer": "Yes.", "displayOrder": 0}
								"""))
				.andExpect(status().isCreated());
		mvc.perform(withToken(post("/api/v1/admin/competitions/" + compId + "/resources"))
						.contentType("application/json")
						.content("""
								{"title": "AoPS", "url": "https://aops.com", "type": "GUIDE", "isAffiliate": true,
								 "displayOrder": 0}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.isAffiliate", is(true)));

		// Verification + archive/restore round-trip.
		mvc.perform(withToken(put("/api/v1/admin/competitions/" + compId + "/verification"))
						.contentType("application/json").content("{\"state\": \"CURATED\"}"))
				.andExpect(jsonPath("$.verificationState", is("CURATED")));
		mvc.perform(withToken(delete("/api/v1/admin/competitions/" + compId)))
				.andExpect(jsonPath("$.archivedAt", notNullValue()));
		mvc.perform(withToken(post("/api/v1/admin/competitions/" + compId + "/restore")))
				.andExpect(jsonPath("$.archivedAt", nullValue()));
	}

	@Test
	@Order(3)
	void managesLandingContent() throws Exception {
		mvc.perform(withToken(put("/api/v1/admin/hero-cards/MAIN")).contentType("application/json")
						.content("""
								{"imageKey": "hero/main.jpg", "altText": "Students competing",
								 "linkUrl": "/competitions", "description": "Browse competitions"}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.position", is("MAIN")));

		// Upsert: second PUT to the same position updates, never duplicates.
		mvc.perform(withToken(put("/api/v1/admin/hero-cards/MAIN")).contentType("application/json")
						.content("{\"imageKey\": \"hero/main-v2.jpg\", \"altText\": \"New art\"}"))
				.andExpect(jsonPath("$.imageKey", is("hero/main-v2.jpg")));
		mvc.perform(withToken(get("/api/v1/admin/hero-cards"))).andExpect(jsonPath("$", hasSize(1)));

		// Featured slots: replace-the-list, unknown competition rejected.
		mvc.perform(withToken(put("/api/v1/admin/featured-slots")).contentType("application/json")
						.content("{\"competitionIds\": [\"00000000-0000-4000-8000-000000000000\"]}"))
				.andExpect(status().isUnprocessableEntity());
	}

	@Test
	@Order(4)
	void importQueueApprovesIntoARealCompetition() throws Exception {
		String categories = mvc.perform(withToken(get("/api/v1/admin/categories")))
				.andReturn().getResponse().getContentAsString();
		String mathId = findBySlug(categories, "math");

		String submission = """
				{"payload": {"slug": "mathcounts", "name": "MATHCOUNTS", "categoryId": "%s",
				             "participationMode": "BOTH", "delivery": "IN_PERSON",
				             "entryPathway": "SCHOOL_OR_CHAPTER", "costType": "PAID", "recurrence": "ANNUAL",
				             "attributes": {"topics": ["arithmetic", "algebra"]}},
				 "sourceUrl": "https://mathcounts.org", "confidence": 0.85}
				""".formatted(mathId);
		String recordJson = mvc.perform(withToken(post("/api/v1/admin/import-records"))
						.contentType("application/json").content(submission))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status", is("PENDING")))
				.andReturn().getResponse().getContentAsString();
		String recordId = mapper.readTree(recordJson).get("id").asText();

		mvc.perform(withToken(post("/api/v1/admin/import-records/" + recordId + "/approve")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status", is("APPROVED")))
				.andExpect(jsonPath("$.note", containsString("created competition")));

		// The created competition carries provenance = IMPORT with the pipeline's confidence.
		mvc.perform(withToken(get("/api/v1/admin/competitions").param("query", "MATHCOUNTS")))
				.andExpect(jsonPath("$.content[0].provenanceSource", is("IMPORT")))
				.andExpect(jsonPath("$.content[0].provenanceConfidence", is(0.85)));

		// Re-review is refused.
		mvc.perform(withToken(post("/api/v1/admin/import-records/" + recordId + "/approve")))
				.andExpect(status().isConflict());

		// Reject path.
		String badRecord = mvc.perform(withToken(post("/api/v1/admin/import-records"))
						.contentType("application/json")
						.content("{\"payload\": {\"garbage\": true}, \"confidence\": 0.10}"))
				.andReturn().getResponse().getContentAsString();
		String badId = mapper.readTree(badRecord).get("id").asText();
		// Garbage parses to a request full of nulls → approve fails validation, stays PENDING…
		mvc.perform(withToken(post("/api/v1/admin/import-records/" + badId + "/approve")))
				.andExpect(status().isUnprocessableEntity());
		// …and can then be rejected with a note.
		mvc.perform(withToken(post("/api/v1/admin/import-records/" + badId + "/reject"))
						.contentType("application/json").content("{\"note\": \"unusable extraction\"}"))
				.andExpect(jsonPath("$.status", is("REJECTED")));
	}

	private String findBySlug(String categoriesJson, String slug) throws Exception {
		for (JsonNode node : mapper.readTree(categoriesJson)) {
			if (slug.equals(node.get("slug").asText())) {
				return node.get("id").asText();
			}
		}
		throw new AssertionError("seeded category missing: " + slug);
	}
}
