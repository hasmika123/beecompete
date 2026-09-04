package com.beecompete.catalog.curation;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
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
import org.junit.jupiter.api.BeforeEach;
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
 * DQ4 Phase-1 slice end-to-end on real Postgres ({@code docs/duplicate-detection-plan.md}): the
 * DB-computed name/URL keys (migration {@code 0026}), the write gate's 409/422 split and its
 * {@code confirmNotDuplicate} override, the unique-index backstop, the {@code /duplicates}
 * lookups, the import queue's flags and pending twins, and the organization gate.
 *
 * <p>Every fixture name here starts with "Dupe" so nothing collides with the other integration
 * classes sharing the container — and so the similarity rule never reaches across suites.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "admin.api-token=test-admin-token")
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DuplicateDetectionIntegrationTest {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private ObjectMapper mapper;

	private static String mathId;
	private static String orgId;
	private static String seriesId;
	private static String seriesArchivedTwinId;

	private MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder builder) {
		return builder.header(AdminTokenFilter.HEADER, "test-admin-token");
	}

	@BeforeEach
	void fixtures() throws Exception {
		if (mathId != null) {
			return;
		}
		String categories = mvc.perform(withToken(get("/api/v1/admin/categories")))
				.andReturn().getResponse().getContentAsString();
		for (JsonNode node : mapper.readTree(categories)) {
			if ("math".equals(node.get("slug").asText())) {
				mathId = node.get("id").asText();
			}
		}
		// One organizer for every competition fixture, by id: attributing by NAME would run the
		// organizer resolver, whose own similarity rule is not what these tests are about.
		String org = mvc.perform(withToken(post("/api/v1/admin/organizations")).contentType("application/json")
						.content("{\"name\": \"Dupe Fixtures Org\", \"type\": \"HOST\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		orgId = mapper.readTree(org).get("id").asText();
	}

	private String competition(String slug, String name, String officialUrl, Boolean confirmNotDuplicate) {
		StringBuilder sb = new StringBuilder("{\"slug\": \"").append(slug).append("\", \"name\": \"").append(name)
				.append("\", \"categoryId\": \"").append(mathId).append("\", \"organizerOrgId\": \"").append(orgId)
				.append('"');
		if (officialUrl != null) {
			sb.append(", \"officialUrl\": \"").append(officialUrl).append('"');
		}
		if (confirmNotDuplicate != null) {
			sb.append(", \"confirmNotDuplicate\": ").append(confirmNotDuplicate);
		}
		return sb.append(", \"participationMode\": \"INDIVIDUAL\", \"delivery\": \"VIRTUAL\","
				+ " \"entryPathways\": [\"INDIVIDUAL\"], \"costType\": \"FREE\", \"recurrence\": \"ANNUAL\"}")
				.toString();
	}

	private MockHttpServletRequestBuilder create(String json) {
		return withToken(post("/api/v1/admin/competitions")).contentType("application/json").content(json);
	}

	@Test
	@Order(1)
	void liveExactNameIsAHardConflictAndSoftSignalsNeedConfirmation() throws Exception {
		String created = mvc.perform(create(competition("dupe-series", "Dupe QUANTUM® Relay Series",
						"https://www.dupe-quantum.example.org/programs/relay-series/", null)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		seriesId = mapper.readTree(created).get("id").asText();

		// Case, punctuation and whitespace fold into the same name key → 409, and the override
		// does not apply: two live listings may not share a name (uq_competition_name_key_live).
		mvc.perform(create(competition("dupe-series-2", "dupe   quantum - relay series!", null, true)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message", containsString("already has this name")))
				.andExpect(jsonPath("$.message", containsString("dupe-series")));

		// Same official URL under a different name — scheme, www., query string and trailing slash
		// all fold away — is a SOFT signal: 422 naming the candidate and the reason…
		String chapter = competition("dupe-chapter", "Dupe QUANTUM Chapter Round",
				"http://dupe-quantum.example.org/programs/relay-series?utm=x", null);
		mvc.perform(create(chapter))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.message", containsString("possible duplicate")))
				.andExpect(jsonPath("$.message", containsString("URL_EXACT")))
				.andExpect(jsonPath("$.message", containsString("[dupe-series]")));
		// …and nothing was created.
		mvc.perform(withToken(get("/api/v1/admin/competitions").param("query", "Dupe QUANTUM Chapter")))
				.andExpect(jsonPath("$.content", hasSize(0)));

		// A similar name alone (no shared URL) is the same soft signal.
		mvc.perform(create(competition("dupe-series-state", "Dupe QUANTUM Relay Series State", null, null)))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.message", containsString("NAME_SIMILAR")));

		// confirmNotDuplicate=true is the curator saying "I looked" — the soft signals step aside.
		mvc.perform(create(competition("dupe-chapter", "Dupe QUANTUM Chapter Round",
						"http://dupe-quantum.example.org/programs/relay-series?utm=x", true)))
				.andExpect(status().isCreated());

		// An unrelated name with no URL sails through untouched.
		mvc.perform(create(competition("dupe-quiet", "Dupe Quiet Geography Bee", null, null)))
				.andExpect(status().isCreated());
	}

	@Test
	@Order(2)
	void updateRegatesOnlyWhenNameOrUrlChanges() throws Exception {
		String quiet = mvc.perform(withToken(get("/api/v1/admin/competitions").param("query", "Dupe Quiet")))
				.andReturn().getResponse().getContentAsString();
		String quietId = mapper.readTree(quiet).get("content").get(0).get("id").asText();

		// Renaming onto a live listing's name → 409, override or not.
		mvc.perform(withToken(put("/api/v1/admin/competitions/" + quietId)).contentType("application/json")
						.content(competition("dupe-quiet", "Dupe Quantum Relay Series", null, true)))
				.andExpect(status().isConflict());
		// Renaming onto a SIMILAR name → 422 without the override, 200 with it…
		mvc.perform(withToken(put("/api/v1/admin/competitions/" + quietId)).contentType("application/json")
						.content(competition("dupe-quiet", "Dupe Quiet Geography Bee Junior", null, null)))
				.andExpect(status().isOk()); // "Junior" makes it similar to ITSELF only — self is excluded
		mvc.perform(withToken(put("/api/v1/admin/competitions/" + quietId)).contentType("application/json")
						.content(competition("dupe-quiet", "Dupe QUANTUM Chapter Round Junior", null, null)))
				.andExpect(status().isUnprocessableEntity());
		mvc.perform(withToken(put("/api/v1/admin/competitions/" + quietId)).contentType("application/json")
						.content(competition("dupe-quiet", "Dupe QUANTUM Chapter Round Junior", null, true)))
				.andExpect(status().isOk());
		// …and a save that touches neither name nor URL is never re-gated, so a listing confirmed
		// once stays saveable without confirming forever.
		mvc.perform(withToken(put("/api/v1/admin/competitions/" + quietId)).contentType("application/json")
						.content(competition("dupe-quiet", "Dupe QUANTUM Chapter Round Junior", null, null)
								.replace("\"costType\": \"FREE\"", "\"costType\": \"PAID\"")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.costType", is("PAID")));
	}

	@Test
	@Order(3)
	void archivedExactNameIsSoftAndTheIndexStopsARestoreOverIt() throws Exception {
		mvc.perform(withToken(delete("/api/v1/admin/competitions/" + seriesId))).andExpect(status().isOk());

		// Archived exact match: a signal (restore it? or is this genuinely new?), not a wall.
		mvc.perform(create(competition("dupe-series-again", "Dupe Quantum Relay Series", null, null)))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.message", containsString("archived")));
		String twin = mvc.perform(create(competition("dupe-series-again", "Dupe Quantum Relay Series",
						null, true)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		seriesArchivedTwinId = mapper.readTree(twin).get("id").asText();

		// Now two rows share the key and one is archived — restoring the archived one would make
		// two LIVE same-named listings, and the partial unique index refuses it as a 409.
		mvc.perform(withToken(post("/api/v1/admin/competitions/" + seriesId + "/restore")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message", containsString("rename")));
	}

	@Test
	@Order(4)
	void duplicatesLookupAnswersBeforeSubmit() throws Exception {
		mvc.perform(withToken(get("/api/v1/admin/competitions/duplicates"))
						.param("name", "dupe quantum relay series")
						.param("officialUrl", "https://dupe-quantum.example.org/programs/relay-series"))
				.andExpect(status().isOk())
				// Live exact first, then the archived exact, then the URL-only sibling.
				.andExpect(jsonPath("$.catalog[0].slug", is("dupe-series-again")))
				.andExpect(jsonPath("$.catalog[0].reasons", hasItem("NAME_EXACT")))
				.andExpect(jsonPath("$.catalog[0].archivedAt", nullValue()))
				.andExpect(jsonPath("$.catalog[1].slug", is("dupe-series")))
				.andExpect(jsonPath("$.catalog[1].archivedAt", notNullValue()))
				.andExpect(jsonPath("$.catalog[*].slug", hasItem("dupe-chapter")))
				.andExpect(jsonPath("$.pending", hasSize(0)));

		// The row being edited is never its own duplicate.
		mvc.perform(withToken(get("/api/v1/admin/competitions/duplicates"))
						.param("name", "Dupe Quantum Relay Series")
						.param("excludeId", seriesArchivedTwinId))
				.andExpect(jsonPath("$.catalog[*].slug", not(hasItem("dupe-series-again"))));

		// Nothing to compare → nothing found, never an error.
		mvc.perform(withToken(get("/api/v1/admin/competitions/duplicates")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.catalog", hasSize(0)))
				.andExpect(jsonPath("$.pending", hasSize(0)));
	}

	@Test
	@Order(5)
	void importQueueFlagsCatalogMatchesAndPendingTwins() throws Exception {
		String payload = """
				{"payload": {"slug": "dupe-import", "name": "%s", "categoryId": "%s",
				             "organizerOrgId": "%s", "officialUrl": "%s",
				             "participationMode": "INDIVIDUAL", "delivery": "VIRTUAL",
				             "entryPathways": ["INDIVIDUAL"], "costType": "FREE", "recurrence": "ANNUAL"},
				 "sourceUrl": "%s", "confidence": 0.8}
				""";
		// Ingest is lenient (201) but the reply already says what the queue will show.
		String first = mvc.perform(withToken(post("/api/v1/admin/import-records")).contentType("application/json")
						.content(payload.formatted("Dupe Quantum Relay Series", mathId, orgId,
								"https://dupe-quantum.example.org/programs/relay-series",
								"https://dupe-quantum.example.org/programs/relay-series")))
				.andExpect(status().isCreated())
				// The strongest match is the live same-named listing (which carries no URL); the
				// URL match is a sibling further down the full list.
				.andExpect(jsonPath("$.duplicate.slug", is("dupe-series-again")))
				.andExpect(jsonPath("$.duplicate.reasons", hasItem("NAME_EXACT")))
				.andExpect(jsonPath("$.duplicates.catalog[*].reasons[*]", hasItem("URL_EXACT")))
				.andExpect(jsonPath("$.pendingTwins", is(0)))
				.andExpect(jsonPath("$.duplicates.catalog", hasSize(greaterThanOrEqualTo(2))))
				.andReturn().getResponse().getContentAsString();
		String firstId = mapper.readTree(first).get("id").asText();

		// A second submission of the same page (different extracted name) is the first one's twin.
		String second = mvc.perform(withToken(post("/api/v1/admin/import-records")).contentType("application/json")
						.content(payload.formatted("Dupe Quantum (Series)", mathId, orgId,
								"http://www.dupe-quantum.example.org/programs/relay-series/",
								"https://dupe-quantum.example.org/programs/relay-series")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.pendingTwins", is(1)))
				.andExpect(jsonPath("$.duplicates.pending[0].importRecordId", is(firstId)))
				.andExpect(jsonPath("$.duplicates.pending[0].reasons", hasItem("URL_EXACT")))
				.andReturn().getResponse().getContentAsString();
		String secondId = mapper.readTree(second).get("id").asText();

		// The list carries the cheap signals + twin counts for every row on the page, in bulk.
		mvc.perform(withToken(get("/api/v1/admin/import-records")).param("query", "Dupe Quantum"))
				.andExpect(jsonPath("$.content", hasSize(2)))
				.andExpect(jsonPath("$.content[0].duplicate.reasons", hasItem("NAME_EXACT")))
				.andExpect(jsonPath("$.content[0].pendingTwins", is(1)))
				.andExpect(jsonPath("$.content[1].duplicate.reasons", hasItem("URL_EXACT")))
				.andExpect(jsonPath("$.content[1].pendingTwins", is(1)))
				.andExpect(jsonPath("$.content[0].duplicates", nullValue()));
		// The single read runs full detection.
		mvc.perform(withToken(get("/api/v1/admin/import-records/" + secondId)))
				.andExpect(jsonPath("$.duplicates.catalog[*].reasons[*]", hasItem("URL_EXACT")))
				.andExpect(jsonPath("$.duplicates.pending", hasSize(1)));

		// Approving the first over the live same-named listing is the gate's 409 — with or
		// without the override; bulk approve reports it per row and the record stays pending.
		mvc.perform(withToken(post("/api/v1/admin/import-records/" + firstId + "/approve")))
				.andExpect(status().isConflict());
		mvc.perform(withToken(post("/api/v1/admin/import-records/bulk")).contentType("application/json")
						.content("{\"ids\": [\"" + firstId + "\"], \"action\": \"APPROVE\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.failed", is(1)))
				.andExpect(jsonPath("$.results[0].error", containsString("already has this name")));
		// The second (URL-only match) needs the curator's word, which the review form sends.
		mvc.perform(withToken(post("/api/v1/admin/import-records/" + secondId + "/approve")))
				.andExpect(status().isUnprocessableEntity());
		mvc.perform(withToken(post("/api/v1/admin/import-records/" + secondId + "/approve"))
						.contentType("application/json")
						.content(mapper.readTree(second).get("payload").toString()
								.replaceFirst("\\{", "{\"confirmNotDuplicate\": true, ")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status", is("APPROVED")));
		mvc.perform(withToken(post("/api/v1/admin/import-records/" + firstId + "/reject")))
				.andExpect(status().isOk());
	}

	@Test
	@Order(6)
	void organizationCreateAndUpdateAreGatedToo() throws Exception {
		String org = "{\"name\": \"%s\", \"type\": \"HOST\"%s%s}";
		mvc.perform(withToken(post("/api/v1/admin/organizations")).contentType("application/json")
						.content(org.formatted("Dupe Robotics Alliance", ", \"domain\": \"https://www.dupe-robotics.example.org/x\"", "")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.domain", is("dupe-robotics.example.org")));

		// Live exact name → 409, override or not (use it, or tell them apart).
		mvc.perform(withToken(post("/api/v1/admin/organizations")).contentType("application/json")
						.content(org.formatted("DUPE ROBOTICS ALLIANCE!", "", ", \"confirmNotDuplicate\": true")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message", containsString("already has this name")));
		// Same registrable domain under another name → 422 naming the reason…
		mvc.perform(withToken(post("/api/v1/admin/organizations")).contentType("application/json")
						.content(org.formatted("Dupe Alliance Foundation", ", \"domain\": \"dupe-robotics.example.org\"", "")))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.message", containsString("DOMAIN_EXACT")));
		// …a similar / containing name likewise…
		mvc.perform(withToken(post("/api/v1/admin/organizations")).contentType("application/json")
						.content(org.formatted("Dupe Robotics Alliance Foundation", "", "")))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.message", containsString("NAME_SIMILAR")));
		// …and both step aside on confirmNotDuplicate.
		String foundation = mvc.perform(withToken(post("/api/v1/admin/organizations")).contentType("application/json")
						.content(org.formatted("Dupe Robotics Alliance Foundation",
								", \"domain\": \"dupe-robotics.example.org\"", ", \"confirmNotDuplicate\": true")))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String foundationId = mapper.readTree(foundation).get("id").asText();

		// The lookup the form calls before submit.
		mvc.perform(withToken(get("/api/v1/admin/organizations/duplicates")).param("name", "dupe robotics alliance"))
				.andExpect(jsonPath("$[0].reasons", hasItem("NAME_EXACT")))
				.andExpect(jsonPath("$[1].reasons", hasItem("NAME_SIMILAR")));

		// Update: a rename onto the live exact name is a 409; a save that changes neither name nor
		// domain is not re-gated.
		mvc.perform(withToken(put("/api/v1/admin/organizations/" + foundationId)).contentType("application/json")
						.content(org.formatted("Dupe Robotics Alliance", ", \"domain\": \"dupe-robotics.example.org\"", "")))
				.andExpect(status().isConflict());
		mvc.perform(withToken(put("/api/v1/admin/organizations/" + foundationId)).contentType("application/json")
						.content("{\"name\": \"Dupe Robotics Alliance Foundation\", \"type\": \"SPONSOR\","
								+ " \"domain\": \"dupe-robotics.example.org\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.type", is("SPONSOR")));

		// The organizer resolver shares the detection: a competition naming an org on the same
		// domain as an existing one — different name — is refused until the curator decides.
		mvc.perform(create(competition("dupe-robo-open", "Dupe Robo Open", "https://dupe-robotics.example.org/open", null)
						.replace("\"organizerOrgId\": \"" + orgId + "\"", "\"organizerName\": \"Dupe Robo Open Committee\"")))
				.andExpect(status().isUnprocessableEntity())
				.andExpect(jsonPath("$.message", containsString("similar organizations exist")))
				.andExpect(jsonPath("$.message", containsString("DOMAIN_EXACT")));
	}
}
