package com.beecompete.catalog.curation;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.beecompete.TestcontainersConfiguration;
import com.beecompete.platform.web.AdminTokenFilter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * R1-3b corrections end-to-end on real Postgres: the PUBLIC intake (no token) with its field
 * whitelist + subject-existence gates, and the admin review queue — approve applies the diff
 * to the subject through the curation write path (provenance restamped), reject discards,
 * re-review conflicts. Uses the seeded R1-2 taxonomy.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "admin.api-token=test-admin-token")
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class CorrectionsIntegrationTest {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private ObjectMapper mapper;

	private static String competitionId;
	private static String editionId;
	private static String resourceId;

	private MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder builder) {
		return builder.header(AdminTokenFilter.HEADER, "test-admin-token");
	}

	@Test
	@Order(1)
	void adminQueueIsTokenGatedButIntakeIsPublic() throws Exception {
		mvc.perform(get("/api/v1/admin/corrections")).andExpect(status().isUnauthorized());
		// The public intake is NOT behind the admin filter — a bad body 400s instead of 401ing.
		mvc.perform(post("/api/v1/corrections").contentType("application/json").content("{}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	@Order(2)
	void publicIntakeValidatesWhitelistAndSubject() throws Exception {
		seedSubjects();

		// Unknown field → 422 with the offending key named.
		mvc.perform(post("/api/v1/corrections").contentType("application/json").content("""
						{"subjectType": "COMPETITION", "subjectId": "%s",
						 "payload": {"slug": "hijack", "name": "ok"}}
						""".formatted(competitionId)))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.message", containsString("slug")));

		// Unknown subject row → 422.
		mvc.perform(post("/api/v1/corrections").contentType("application/json").content("""
						{"subjectType": "COMPETITION", "subjectId": "00000000-0000-4000-8000-000000000000",
						 "payload": {"name": "Whatever"}}
						"""))
				.andExpect(status().isUnprocessableEntity());

		// Good submission → 201 PENDING, minimal acknowledgement.
		mvc.perform(post("/api/v1/corrections").contentType("application/json").content("""
						{"subjectType": "COMPETITION", "subjectId": "%s",
						 "payload": {"name": "Science Bowl (National)", "minGrade": 6},
						 "note": "The official site now brands it with (National)."}
						""".formatted(competitionId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status", is("PENDING")))
				.andExpect(jsonPath("$.id", notNullValue()));
	}

	@Test
	@Order(3)
	void approveAppliesTheDiffThroughTheCurationWritePath() throws Exception {
		String id = pendingId(0);

		// Detail exposes current-vs-proposed for the review UI.
		mvc.perform(withToken(get("/api/v1/admin/corrections/" + id)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.currentValues.name", is("Science Bowl")))
				.andExpect(jsonPath("$.payload.name", is("Science Bowl (National)")));

		mvc.perform(withToken(post("/api/v1/admin/corrections/" + id + "/approve")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status", is("APPROVED")))
				.andExpect(jsonPath("$.note", containsString("[curator] applied")))
				// The submitter's note survives the review (audit trail, D7).
				.andExpect(jsonPath("$.note", containsString("official site")));

		// The diff landed; untouched fields kept; provenance restamped by the write path.
		mvc.perform(withToken(get("/api/v1/admin/competitions/" + competitionId)))
				.andExpect(jsonPath("$.name", is("Science Bowl (National)")))
				.andExpect(jsonPath("$.minGrade", is(6)))
				.andExpect(jsonPath("$.maxGrade", is(12)))
				.andExpect(jsonPath("$.slug", is("science-bowl")))
				.andExpect(jsonPath("$.provenanceSource", is("CURATED")));

		// Re-review is refused.
		mvc.perform(withToken(post("/api/v1/admin/corrections/" + id + "/approve")))
				.andExpect(status().isConflict());
	}

	@Test
	@Order(4)
	void editionAndResourceCorrectionsApplyAndBadMergesFail() throws Exception {
		// Edition: fix the entry fee via override (curator edit-then-approve).
		String editionCorrection = submit("""
				{"subjectType": "EDITION", "subjectId": "%s", "payload": {"entryFee": 99}}
				""".formatted(editionId));
		mvc.perform(withToken(post("/api/v1/admin/corrections/" + editionCorrection + "/approve"))
						.contentType("application/json").content("{\"entryFee\": 30.00}"))
				.andExpect(status().isOk());
		mvc.perform(withToken(get("/api/v1/admin/editions/" + editionId)))
				.andExpect(jsonPath("$.entryFee", is(30.00)))
				.andExpect(jsonPath("$.cycleLabel", is("2026")));

		// Resource: title fix.
		String resourceCorrection = submit("""
				{"subjectType": "RESOURCE", "subjectId": "%s", "payload": {"title": "Official study guide"}}
				""".formatted(resourceId));
		mvc.perform(withToken(post("/api/v1/admin/corrections/" + resourceCorrection + "/approve")))
				.andExpect(status().isOk());
		mvc.perform(withToken(get("/api/v1/admin/competitions/" + competitionId + "/resources")))
				.andExpect(jsonPath("$[0].title", is("Official study guide")));

		// A merge that breaks the record (blank name) fails the approve and stays PENDING…
		String badCorrection = submit("""
				{"subjectType": "COMPETITION", "subjectId": "%s", "payload": {"name": ""}}
				""".formatted(competitionId));
		mvc.perform(withToken(post("/api/v1/admin/corrections/" + badCorrection + "/approve")))
				.andExpect(status().isUnprocessableEntity());
		// …and can be rejected with a curator note appended, submitter note kept.
		mvc.perform(withToken(post("/api/v1/admin/corrections/" + badCorrection + "/reject"))
						.contentType("application/json").content("{\"note\": \"blank name\"}"))
				.andExpect(jsonPath("$.status", is("REJECTED")))
				.andExpect(jsonPath("$.note", containsString("[curator] blank name")));

		// An approve override is whitelist-checked too — a stored/overridden payload can't smuggle fields.
		String smuggle = submit("""
				{"subjectType": "COMPETITION", "subjectId": "%s", "payload": {"name": "x"}}
				""".formatted(competitionId));
		mvc.perform(withToken(post("/api/v1/admin/corrections/" + smuggle + "/approve"))
						.contentType("application/json").content("{\"slug\": \"stolen-slug\"}"))
				.andExpect(status().isUnprocessableEntity());
	}

	private String submit(String body) throws Exception {
		String json = mvc.perform(post("/api/v1/corrections").contentType("application/json").content(body))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return mapper.readTree(json).get("id").asText();
	}

	private String pendingId(int index) throws Exception {
		String json = mvc.perform(withToken(get("/api/v1/admin/corrections?status=PENDING&size=50")))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		return mapper.readTree(json).get("content").get(index).get("id").asText();
	}

	private void seedSubjects() throws Exception {
		if (competitionId != null) {
			return;
		}
		String categories = mvc.perform(withToken(get("/api/v1/admin/categories")))
				.andReturn().getResponse().getContentAsString();
		String scienceId = null;
		for (JsonNode node : mapper.readTree(categories)) {
			if ("science-engineering".equals(node.get("slug").asText())) {
				scienceId = node.get("id").asText();
			}
		}
		if (scienceId == null) {
			throw new AssertionError("seeded category missing: science-engineering");
		}

		String compJson = mvc.perform(withToken(post("/api/v1/admin/competitions"))
						.contentType("application/json").content("""
								{"slug": "science-bowl", "name": "Science Bowl", "categoryId": "%s",
								 "maxGrade": 12, "participationMode": "TEAM", "delivery": "IN_PERSON",
								 "entryPathway": "SCHOOL_OR_CHAPTER", "costType": "FREE", "recurrence": "ANNUAL"}
								""".formatted(scienceId)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		competitionId = mapper.readTree(compJson).get("id").asText();

		String editionJson = mvc.perform(withToken(post("/api/v1/admin/competitions/" + competitionId + "/editions"))
						.contentType("application/json").content("""
								{"cycleLabel": "2026", "status": "UPCOMING", "scopeLevel": "NATIONAL",
								 "entryFee": 25.00, "currency": "USD"}
								"""))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		editionId = mapper.readTree(editionJson).get("id").asText();

		String resourceJson = mvc.perform(withToken(post("/api/v1/admin/competitions/" + competitionId + "/resources"))
						.contentType("application/json").content("""
								{"title": "Study guide", "url": "https://example.org/guide", "type": "GUIDE",
								 "displayOrder": 0}
								"""))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		resourceId = mapper.readTree(resourceJson).get("id").asText();
	}
}
