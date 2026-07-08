package com.beecompete;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the BeeCompete API — a modular monolith (architecture §4).
 *
 * <p>Domain modules live in sibling packages ({@code accounts}, {@code catalog},
 * {@code discovery}, {@code journey}, {@code platform}); each owns its entities,
 * services, and API, and cross-module calls go through service interfaces.
 */
@SpringBootApplication
public class BeeCompeteApplication {

	public static void main(String[] args) {
		SpringApplication.run(BeeCompeteApplication.class, args);
	}

}
