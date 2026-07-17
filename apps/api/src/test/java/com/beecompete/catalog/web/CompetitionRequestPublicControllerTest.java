package com.beecompete.catalog.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.beecompete.TestcontainersConfiguration;
import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.domain.ImportStatus;
import com.beecompete.catalog.repository.ImportRecordRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * R1-15b public "Request a Competition" intake (DQ15): a request lands in the import queue as a
 * PENDING, user-submitted candidate (null confidence + request note), the endpoint is public
 * (not token-gated), and a blank name is rejected.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "admin.api-token=test-admin-token")
@AutoConfigureMockMvc
class CompetitionRequestPublicControllerTest {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private ImportRecordRepository imports;

	@Test
	void publicRequestQueuesAPendingImportRecord() throws Exception {
		mvc.perform(post("/api/v1/competition-requests").contentType("application/json").content("""
						{"name": "Regional Robotics Rumble", "organizerName": "Robotics Guild",
						 "officialUrl": "https://example.org/rumble", "categorySlug": "robotics",
						 "grades": "6-12", "deadline": "March 2027", "details": "Missing from your catalog."}
						""")).andExpect(status().isCreated()).andExpect(jsonPath("$.id").exists())
				.andExpect(jsonPath("$.status", org.hamcrest.Matchers.is("PENDING")));

		List<ImportRecord> pending = imports.findAll().stream()
				.filter(r -> "Regional Robotics Rumble".equals(r.getPayload().get("name"))).toList();
		assertThat(pending).hasSize(1);
		ImportRecord record = pending.get(0);
		assertThat(record.getStatus()).isEqualTo(ImportStatus.PENDING);
		// User request, not a pipeline extraction: no confidence, flagged by the note + sourceUrl.
		assertThat(record.getConfidence()).isNull();
		assertThat(record.getSourceUrl()).isEqualTo("https://example.org/rumble");
		assertThat(record.getNote()).contains("DQ15");
		assertThat(record.getPayload()).containsEntry("organizerName", "Robotics Guild")
				.containsEntry("categorySlug", "robotics");
	}

	@Test
	void blankNameIsRejected() throws Exception {
		// Public (not behind the admin filter): a bad body 400s rather than 401ing.
		mvc.perform(post("/api/v1/competition-requests").contentType("application/json")
				.content("""
						{"name": "  ", "details": "no name"}
						""")).andExpect(status().isBadRequest());
	}
}
