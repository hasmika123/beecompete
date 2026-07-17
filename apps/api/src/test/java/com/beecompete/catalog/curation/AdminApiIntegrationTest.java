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
				.andExpect(jsonPath("$.verificationState", is("CURATED"))) // R1-19 default (UNVERIFIED retired)
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

		// A name that can't collide with the 0010 geo seed's natural key (parent, level, name) —
		// the seed already holds COUNTRY "United States".
		String regionJson = mvc.perform(withToken(post("/api/v1/admin/regions"))
						.contentType("application/json")
						.content("{\"level\": \"COUNTRY\", \"name\": \"Curationland\", \"code\": \"CU\"}"))
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

		// Value-prop cards (M36): the two slots are seeded (migration 0011); upsert one, and the
		// label is required. Count stays two — position-keyed upsert, never a duplicate.
		mvc.perform(withToken(put("/api/v1/admin/value-prop-cards/PRIMARY")).contentType("application/json")
						.content("{\"imageKey\": null, \"linkUrl\": \"/competitions\", \"label\": \"Explore all\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.position", is("PRIMARY")))
				.andExpect(jsonPath("$.label", is("Explore all")));
		mvc.perform(withToken(get("/api/v1/admin/value-prop-cards"))).andExpect(jsonPath("$", hasSize(2)));
		mvc.perform(withToken(put("/api/v1/admin/value-prop-cards/PRIMARY")).contentType("application/json")
						.content("{\"linkUrl\": \"/x\", \"label\": \"\"}"))
				.andExpect(status().isBadRequest());

		// Landing stats (M36): value + label required, source optional.
		mvc.perform(withToken(put("/api/v1/admin/landing-stats/PRIMARY")).contentType("application/json")
						.content("{\"value\": \"72%\", \"label\": \"of officers say so\", \"source\": \"NACAC\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.value", is("72%")));
		mvc.perform(withToken(get("/api/v1/admin/landing-stats"))).andExpect(jsonPath("$", hasSize(2)));
	}

	@Test
	@Order(4)
	void importQueueApprovesIntoARealCompetition() throws Exception {
		String categories = mvc.perform(withToken(get("/api/v1/admin/categories")))
				.andReturn().getResponse().getContentAsString();
		String mathId = findBySlug(categories, "math");

		// organizerName (not id) exercises resolve-or-create on approve: no org for "MATHCOUNTS
		// Foundation" exists yet, so approve creates one (CURATED/HOST) and attributes to it.
		String submission = """
				{"payload": {"slug": "mathcounts", "name": "MATHCOUNTS", "categoryId": "%s",
				             "organizerName": "MATHCOUNTS Foundation",
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

		// Resolve-or-create: approve created the organizer org (CURATED/HOST), inheriting the
		// import provenance stamp. The organizerName never reached the queue as an org before now.
		mvc.perform(withToken(get("/api/v1/admin/organizations").param("query", "MATHCOUNTS Foundation")))
				.andExpect(jsonPath("$.content", hasSize(1)))
				.andExpect(jsonPath("$.content[0].type", is("HOST")))
				.andExpect(jsonPath("$.content[0].verificationState", is("CURATED")));

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

	@Test
	@Order(5)
	void enforcesConflictsAndTheArchivedFeaturedGuard() throws Exception {
		String categories = mvc.perform(withToken(get("/api/v1/admin/categories")))
				.andReturn().getResponse().getContentAsString();
		String mathId = findBySlug(categories, "math");

		String amcJson = mvc.perform(withToken(get("/api/v1/admin/competitions").param("query", "AMC 10")))
				.andReturn().getResponse().getContentAsString();
		String amcId = mapper.readTree(amcJson).get("content").get(0).get("id").asText();

		// Feature it, then archive it → the archive must pull it from the carousel (no 500).
		mvc.perform(withToken(put("/api/v1/admin/featured-slots")).contentType("application/json")
						.content("{\"competitionIds\": [\"" + amcId + "\"]}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)));
		mvc.perform(withToken(delete("/api/v1/admin/competitions/" + amcId)))
				.andExpect(jsonPath("$.archivedAt", notNullValue()));
		mvc.perform(withToken(get("/api/v1/admin/featured-slots")))
				.andExpect(jsonPath("$", hasSize(0)));

		// Featuring an archived competition is rejected (422), not silently allowed.
		mvc.perform(withToken(put("/api/v1/admin/featured-slots")).contentType("application/json")
						.content("{\"competitionIds\": [\"" + amcId + "\"]}"))
				.andExpect(status().isUnprocessableEntity());

		// Deleting an in-use category → 409 (FK), not a 500.
		mvc.perform(withToken(delete("/api/v1/admin/categories/" + mathId)))
				.andExpect(status().isConflict());
	}

	@Test
	@Order(6)
	void combinedCreateMakesAListingLiveInOneCall() throws Exception {
		String categories = mvc.perform(withToken(get("/api/v1/admin/categories")))
				.andReturn().getResponse().getContentAsString();
		String mathId = findBySlug(categories, "math");

		// Fixtures the completeness gates require: an organizer + a region to tag.
		String orgJson = mvc.perform(withToken(post("/api/v1/admin/organizations"))
						.contentType("application/json")
						.content("{\"name\": \"Combined Org\", \"type\": \"HOST\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String orgId = mapper.readTree(orgJson).get("id").asText();
		String regionJson = mvc.perform(withToken(post("/api/v1/admin/regions"))
						.contentType("application/json")
						.content("{\"level\": \"COUNTRY\", \"name\": \"Combinedland\", \"code\": \"CL\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String regionId = mapper.readTree(regionJson).get("id").asText();

		// Happy path: competition + first edition + typed key dates (item 21) + region, one POST.
		// The RESULTS row is TBD (startsAt null, R1-18) and carries a label.
		String body = """
				{"competition": {"slug": "combined-open", "name": "Combined Open",
				  "categoryId": "%s", "organizerOrgId": "%s", "summary": "One-call create.",
				  "description": "A complete-by-default listing created in one call.",
				  "officialUrl": "https://combined.example.org", "participationMode": "INDIVIDUAL",
				  "delivery": "VIRTUAL", "entryPathway": "INDIVIDUAL", "costType": "FREE",
				  "recurrence": "ANNUAL"},
				 "edition": {"cycleLabel": "2026", "status": "OPEN", "scopeLevel": "NATIONAL",
				  "registrationUrl": "https://combined.example.org/register", "prizeSummary": "Medals"},
				 "keyDates": [
				  {"type": "REG_CLOSE", "startsAt": "2026-11-01T04:59:00Z", "timezone": "America/New_York"},
				  {"type": "RESULTS", "label": "Winners announced", "timezone": "America/New_York"}],
				 "regionIds": ["%s"]}
				""".formatted(mathId, orgId, regionId);
		String created = mvc.perform(withToken(post("/api/v1/admin/competitions/with-edition"))
						.contentType("application/json").content(body))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.slug", is("combined-open")))
				.andExpect(jsonPath("$.provenanceSource", is("CURATED")))
				.andReturn().getResponse().getContentAsString();
		String compId = mapper.readTree(created).get("id").asText();

		// The edition, both typed key dates, and the region tag were created alongside.
		String editions = mvc.perform(withToken(get("/api/v1/admin/competitions/" + compId + "/editions")))
				.andExpect(jsonPath("$", hasSize(1)))
				.andReturn().getResponse().getContentAsString();
		String editionId = mapper.readTree(editions).get(0).get("id").asText();
		mvc.perform(withToken(get("/api/v1/admin/editions/" + editionId + "/key-dates")))
				.andExpect(jsonPath("$", hasSize(2)))
				.andExpect(jsonPath("$[0].type", is("REG_CLOSE")))
				.andExpect(jsonPath("$[1].type", is("RESULTS"))) // TBD rows (null startsAt) sort last
				.andExpect(jsonPath("$[1].label", is("Winners announced")))
				.andExpect(jsonPath("$[1].startsAt", nullValue()));
		mvc.perform(withToken(get("/api/v1/admin/editions/" + editionId + "/regions")))
				.andExpect(jsonPath("$", hasSize(1)));

		// And the listing is immediately public — it clears the readiness gate (§8a) because it
		// has a live edition. (A bare admin-create would have been an invisible zombie.)
		mvc.perform(get("/api/v1/competitions/combined-open"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.editions", hasSize(1)));

		// Completeness gate (item 21): without a REG_CLOSE/SUBMISSION_DUE row the create is a 400 —
		// the card/search deadline (blueprint #31) would have nothing to read.
		String noDeadline = body.replace("\"combined-open\"", "\"combined-no-deadline\"")
				.replace("\"Combined Open\"", "\"Combined No Deadline\"")
				.replace("\"REG_CLOSE\"", "\"ROUND_START\"");
		mvc.perform(withToken(post("/api/v1/admin/competitions/with-edition"))
						.contentType("application/json").content(noDeadline))
				.andExpect(status().isBadRequest());

		// Atomicity: a failure while creating the edition rolls back the whole thing — the
		// competition must NOT persist (no zombie). Bad advances-to id fails inside the edition
		// write (a 422 AFTER bean validation passed), after the competition would have been saved.
		String rollback = """
				{"competition": {"slug": "combined-rollback", "name": "Combined Rollback",
				  "categoryId": "%s", "organizerOrgId": "%s", "summary": "Rollback probe.",
				  "description": "Must not survive the failed edition write.",
				  "officialUrl": "https://combined.example.org", "participationMode": "INDIVIDUAL",
				  "delivery": "VIRTUAL", "entryPathway": "INDIVIDUAL", "costType": "FREE",
				  "recurrence": "ANNUAL"},
				 "edition": {"cycleLabel": "2026", "status": "OPEN", "scopeLevel": "NATIONAL",
				  "registrationUrl": "https://combined.example.org/register", "prizeSummary": "Medals",
				  "advancesToEditionId": "00000000-0000-4000-8000-000000000000"},
				 "keyDates": [{"type": "REG_CLOSE", "timezone": "America/New_York"}],
				 "regionIds": ["%s"]}
				""".formatted(mathId, orgId, regionId);
		mvc.perform(withToken(post("/api/v1/admin/competitions/with-edition"))
						.contentType("application/json").content(rollback))
				.andExpect(status().isUnprocessableEntity());
		mvc.perform(withToken(get("/api/v1/admin/competitions").param("query", "Combined Rollback")))
				.andExpect(jsonPath("$.content", hasSize(0)));
	}

	@Test
	@Order(7)
	void resolvesOrCreatesOrganizerByName() throws Exception {
		String categories = mvc.perform(withToken(get("/api/v1/admin/categories")))
				.andReturn().getResponse().getContentAsString();
		String mathId = findBySlug(categories, "math");

		// Exact-name reuse + auto-create shape: first create makes the org (CURATED/HOST, domain
		// inferred from officialUrl with a leading www. stripped).
		mvc.perform(withToken(post("/api/v1/admin/competitions")).contentType("application/json")
						.content(byName("alpha-reuse-1", "Alpha Reuse One", mathId, "Alpha Reuse Org",
								"https://www.alphareuse.example.org/comp", null)))
				.andExpect(status().isCreated());
		mvc.perform(withToken(get("/api/v1/admin/organizations").param("query", "Alpha Reuse Org")))
				.andExpect(jsonPath("$.content", hasSize(1)))
				.andExpect(jsonPath("$.content[0].type", is("HOST")))
				.andExpect(jsonPath("$.content[0].verificationState", is("CURATED")))
				.andExpect(jsonPath("$.content[0].domain", is("alphareuse.example.org")));

		// A second competition with the same organizerName REUSES the org — still exactly one.
		mvc.perform(withToken(post("/api/v1/admin/competitions")).contentType("application/json")
						.content(byName("alpha-reuse-2", "Alpha Reuse Two", mathId, "Alpha Reuse Org", null, null)))
				.andExpect(status().isCreated());
		mvc.perform(withToken(get("/api/v1/admin/organizations").param("query", "Alpha Reuse Org")))
				.andExpect(jsonPath("$.content", hasSize(1)));

		// Near-match guard: a SIMILAR (containing) org exists but no exact match → 422 listing the
		// candidate; the competition is NOT created (rolled back before save).
		mvc.perform(withToken(post("/api/v1/admin/competitions")).contentType("application/json")
						.content(byName("beta-league", "Beta League", mathId, "Beta Robotics League", null, null)))
				.andExpect(status().isCreated());
		mvc.perform(withToken(post("/api/v1/admin/competitions")).contentType("application/json")
						.content(byName("beta-sub", "Beta Sub", mathId, "Beta Robotics", null, null)))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.message", containsString("Beta Robotics League")));

		// confirmNewOrganizer=true overrides the guard → creates the new org despite the near match.
		mvc.perform(withToken(post("/api/v1/admin/competitions")).contentType("application/json")
						.content(byName("beta-sub", "Beta Sub", mathId, "Beta Robotics", null, true)))
				.andExpect(status().isCreated());
		mvc.perform(withToken(get("/api/v1/admin/organizations").param("query", "Beta Robotics")))
				.andExpect(jsonPath("$.content", hasSize(2))); // "Beta Robotics" + "Beta Robotics League"

		// Archived exact match → 422 (restore or pick another) — never silently reuse an archived org.
		mvc.perform(withToken(post("/api/v1/admin/competitions")).contentType("application/json")
						.content(byName("gamma-1", "Gamma One", mathId, "Gamma Archive Org", null, null)))
				.andExpect(status().isCreated());
		String gammaOrgs = mvc.perform(withToken(get("/api/v1/admin/organizations")
						.param("query", "Gamma Archive Org")))
				.andExpect(jsonPath("$.content", hasSize(1)))
				.andReturn().getResponse().getContentAsString();
		String gammaOrgId = mapper.readTree(gammaOrgs).get("content").get(0).get("id").asText();
		mvc.perform(withToken(delete("/api/v1/admin/organizations/" + gammaOrgId)))
				.andExpect(jsonPath("$.archivedAt", notNullValue()));
		mvc.perform(withToken(post("/api/v1/admin/competitions")).contentType("application/json")
						.content(byName("gamma-2", "Gamma Two", mathId, "Gamma Archive Org", null, null)))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.message", containsString("archived")));

		// Missing organizer (neither id nor name) → 400 on the direct create (bean validation).
		mvc.perform(withToken(post("/api/v1/admin/competitions")).contentType("application/json")
						.content("""
								{"slug": "no-org", "name": "No Org", "categoryId": "%s",
								 "participationMode": "INDIVIDUAL", "delivery": "VIRTUAL",
								 "entryPathway": "INDIVIDUAL", "costType": "FREE", "recurrence": "ANNUAL"}
								""".formatted(mathId)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message", containsString("organizer is required")));

		// Missing organizer on the IMPORT path → 422 at approve (isOrganizerPresent on validate()).
		String noOrgRecord = mvc.perform(withToken(post("/api/v1/admin/import-records"))
						.contentType("application/json").content("""
								{"payload": {"slug": "import-no-org", "name": "Import No Org", "categoryId": "%s",
								 "participationMode": "INDIVIDUAL", "delivery": "VIRTUAL",
								 "entryPathway": "INDIVIDUAL", "costType": "FREE", "recurrence": "ANNUAL"},
								 "confidence": 0.50}
								""".formatted(mathId)))
				.andReturn().getResponse().getContentAsString();
		String noOrgId = mapper.readTree(noOrgRecord).get("id").asText();
		mvc.perform(withToken(post("/api/v1/admin/import-records/" + noOrgId + "/approve")))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.message", containsString("organizer is required")));
	}

	/** A minimal competition JSON that attributes the organizer by NAME (resolve-or-create path). */
	private String byName(String slug, String name, String catId, String organizerName, String officialUrl,
			Boolean confirmNewOrganizer) {
		StringBuilder sb = new StringBuilder();
		sb.append("{\"slug\": \"").append(slug).append("\", \"name\": \"").append(name)
				.append("\", \"categoryId\": \"").append(catId)
				.append("\", \"organizerName\": \"").append(organizerName).append('"');
		if (officialUrl != null) {
			sb.append(", \"officialUrl\": \"").append(officialUrl).append('"');
		}
		if (confirmNewOrganizer != null) {
			sb.append(", \"confirmNewOrganizer\": ").append(confirmNewOrganizer);
		}
		sb.append(", \"participationMode\": \"INDIVIDUAL\", \"delivery\": \"VIRTUAL\","
				+ " \"entryPathway\": \"INDIVIDUAL\", \"costType\": \"FREE\", \"recurrence\": \"ANNUAL\"}");
		return sb.toString();
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
