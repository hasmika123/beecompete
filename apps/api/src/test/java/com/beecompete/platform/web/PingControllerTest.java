package com.beecompete.platform.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Web-slice test for {@link PingController}: confirms versioned JSON is served and
 * Bean Validation rejects bad input with 400.
 */
@WebMvcTest(PingController.class)
class PingControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void ping_defaultsToWorld() throws Exception {
		mockMvc.perform(get("/api/v1/ping"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("ok"))
				.andExpect(jsonPath("$.service").value("BeeCompete API"))
				.andExpect(jsonPath("$.message").value("Hello, world!"));
	}

	@Test
	void ping_echoesValidName() throws Exception {
		mockMvc.perform(get("/api/v1/ping").param("name", "Ada"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("Hello, Ada!"));
	}

	@Test
	void ping_rejectsInvalidName() throws Exception {
		// '@' is outside the allow-list → Bean Validation should reject with 400.
		mockMvc.perform(get("/api/v1/ping").param("name", "bad@name"))
				.andExpect(status().isBadRequest());
	}
}
