plugins {
	// Auto-provisions the Java 21 toolchain (via api.foojay.io) when it isn't installed
	// locally — keeps the build portable across dev machines and CI. Architecture §3.
	id("org.gradle.toolchains.foojay-resolver-convention") version "0.9.0"
}

rootProject.name = "beecompete-api"
