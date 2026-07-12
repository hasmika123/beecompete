package com.beecompete.catalog.web;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
 * R1-4 public catalog read API on real Postgres: no token required, archived records invisible
 * (list + detail), lowercase public enum tokens, verification/provenance exposed, and the
 * binding effective-status rule (a curated-OPEN edition whose REG_CLOSE has passed renders
 * closed; a curated-UPCOMING edition inside its registration window renders open).
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "admin.api-token=test-admin-token")
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class CatalogPublicApiIntegrationTest {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private ObjectMapper mapper;

	private static String liveId;
	private static String archivedId;

	private MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder builder) {
		return builder.header(AdminTokenFilter.HEADER, "test-admin-token");
	}

	@Test
	@Order(1)
	void listsLiveCompetitionsWithoutATokenAndHidesArchived() throws Exception {
		seed();

		String json = mvc.perform(get("/api/v1/competitions?size=100"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(1)))
				.andReturn().getResponse().getContentAsString();

		boolean liveSeen = false;
		for (JsonNode item : mapper.readTree(json).get("content")) {
			if ("catalog-read-archived".equals(item.get("slug").asText())) {
				throw new AssertionError("archived competition leaked into the public list");
			}
			if ("catalog-read-live".equals(item.get("slug").asText())) {
				liveSeen = true;
				// Lowercase public tokens + trust fields (DQ13).
				if (!"individual".equals(item.get("participationMode").asText())
						|| !"unverified".equals(item.get("verificationState").asText())
						|| !"curated".equals(item.get("provenance").get("source").asText())) {
					throw new AssertionError("public tokens/trust fields wrong: " + item);
				}
			}
		}
		if (!liveSeen) {
			throw new AssertionError("live competition missing from the public list");
		}
	}

	@Test
	@Order(2)
	void detailExposesEditionsWithEffectiveStatusAndChildren() throws Exception {
		mvc.perform(get("/api/v1/competitions/catalog-read-live"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name", is("Catalog Read Live")))
				.andExpect(jsonPath("$.category.slug", notNullValue()))
				.andExpect(jsonPath("$.organizer.name", is("Catalog Read Org")))
				.andExpect(jsonPath("$.provenance.source", is("curated")))
				.andExpect(jsonPath("$.editions", hasSize(2)))
				// Edition 1: curated OPEN but REG_CLOSE passed → effective closed.
				.andExpect(jsonPath("$.editions[0].status", is("open")))
				.andExpect(jsonPath("$.editions[0].effectiveStatus", is("closed")))
				.andExpect(jsonPath("$.editions[0].keyDates", hasSize(1)))
				.andExpect(jsonPath("$.editions[0].keyDates[0].type", is("reg_close")))
				// Edition 2: curated UPCOMING, REG_OPEN passed + REG_CLOSE ahead → effective open.
				.andExpect(jsonPath("$.editions[1].status", is("upcoming")))
				.andExpect(jsonPath("$.editions[1].effectiveStatus", is("open")))
				.andExpect(jsonPath("$.editions[1].regions", hasSize(1)))
				.andExpect(jsonPath("$.editions[1].regions[0].code", is("US")))
				.andExpect(jsonPath("$.resources", hasSize(1)))
				.andExpect(jsonPath("$.resources[0].isAffiliate", is(true)))
				.andExpect(jsonPath("$.faqs", hasSize(1)));
	}

	@Test
	@Order(3)
	void archivedAndUnknownSlugsAre404() throws Exception {
		mvc.perform(get("/api/v1/competitions/catalog-read-archived")).andExpect(status().isNotFound());
		mvc.perform(get("/api/v1/competitions/never-existed")).andExpect(status().isNotFound());
	}

	private void seed() throws Exception {
		if (liveId != null) {
			return;
		}
		String categories = mvc.perform(withToken(get("/api/v1/admin/categories")))
				.andReturn().getResponse().getContentAsString();
		String categoryId = mapper.readTree(categories).get(0).get("id").asText();

		String orgJson = mvc.perform(withToken(post("/api/v1/admin/organizations"))
						.contentType("application/json")
						.content("{\"name\": \"Catalog Read Org\", \"type\": \"HOST\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String orgId = mapper.readTree(orgJson).get("id").asText();

		liveId = createCompetition("catalog-read-live", "Catalog Read Live", categoryId, orgId);
		archivedId = createCompetition("catalog-read-archived", "Catalog Read Archived", categoryId, orgId);
		mvc.perform(withToken(delete("/api/v1/admin/competitions/" + archivedId)))
				.andExpect(status().isOk());

		Instant now = Instant.now();

		// Edition 1: curated OPEN, REG_CLOSE 2 days ago → effectively closed.
		String e1 = createEdition(liveId, "2025", "OPEN");
		addKeyDate(e1, "REG_CLOSE", now.minus(2, ChronoUnit.DAYS));

		// Edition 2: curated UPCOMING, REG_OPEN yesterday + REG_CLOSE in 30 days → effectively open.
		String e2 = createEdition(liveId, "2026", "UPCOMING");
		addKeyDate(e2, "REG_OPEN", now.minus(1, ChronoUnit.DAYS));
		addKeyDate(e2, "REG_CLOSE", now.plus(30, ChronoUnit.DAYS));

		String regionJson = mvc.perform(withToken(post("/api/v1/admin/regions"))
						.contentType("application/json")
						.content("{\"level\": \"COUNTRY\", \"name\": \"United States\", \"code\": \"US\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		String regionId = mapper.readTree(regionJson).get("id").asText();
		mvc.perform(withToken(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
						.put("/api/v1/admin/editions/" + e2 + "/regions"))
						.contentType("application/json").content("{\"regionIds\": [\"" + regionId + "\"]}"))
				.andExpect(status().isOk());

		mvc.perform(withToken(post("/api/v1/admin/competitions/" + liveId + "/resources"))
						.contentType("application/json")
						.content("""
								{"title": "Prep book", "url": "https://example.org/book", "type": "BOOK",
								 "isAffiliate": true, "displayOrder": 0}
								"""))
				.andExpect(status().isCreated());
		mvc.perform(withToken(post("/api/v1/admin/competitions/" + liveId + "/faqs"))
						.contentType("application/json")
						.content("{\"question\": \"Is it free?\", \"answer\": \"Yes.\", \"displayOrder\": 0}"))
				.andExpect(status().isCreated());
	}

	private String createCompetition(String slug, String name, String categoryId, String orgId)
			throws Exception {
		String json = mvc.perform(withToken(post("/api/v1/admin/competitions"))
						.contentType("application/json")
						.content("""
								{"slug": "%s", "name": "%s", "categoryId": "%s", "organizerOrgId": "%s",
								 "summary": "Public read API test seed.",
								 "participationMode": "INDIVIDUAL", "delivery": "VIRTUAL",
								 "entryPathway": "INDIVIDUAL", "costType": "FREE", "recurrence": "ANNUAL"}
								""".formatted(slug, name, categoryId, orgId)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return mapper.readTree(json).get("id").asText();
	}

	private String createEdition(String competitionId, String cycle, String status) throws Exception {
		String json = mvc.perform(withToken(post("/api/v1/admin/competitions/" + competitionId + "/editions"))
						.contentType("application/json")
						.content("""
								{"cycleLabel": "%s", "status": "%s", "scopeLevel": "NATIONAL"}
								""".formatted(cycle, status)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return mapper.readTree(json).get("id").asText();
	}

	private void addKeyDate(String editionId, String type, Instant startsAt) throws Exception {
		mvc.perform(withToken(post("/api/v1/admin/editions/" + editionId + "/key-dates"))
						.contentType("application/json")
						.content("{\"type\": \"%s\", \"startsAt\": \"%s\"}".formatted(type, startsAt)))
				.andExpect(status().isCreated());
	}
}
