package com.beecompete.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * Generic institutional party (glossary: Organization; domain-model §3b) — a Host org, a school,
 * a sponsor company. Generic on purpose (D4): "free for schools" and sponsorship stay config, not
 * migrations. Built at R1-1 (2026-07-12) because the catalog needs it: the CompetitionCard and
 * details page attribute the organizer by name, and DQ13 verification attaches to the ORG (verify
 * "MAA" once, not per-competition). {@code Membership}/{@code Role} wait for User (R2-1).
 */
@Entity
@Table(name = "organization")
public class Organization {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@NotBlank
	@Size(max = 300)
	@Column(nullable = false, length = 300)
	private String name;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private OrganizationType type;

	/** Official web domain (e.g. maa.org) — later the anchor for host verification (DQ11). */
	@Column(length = 255)
	private String domain;

	@Embedded
	private Provenance provenance;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(name = "verification_state", nullable = false, length = 20)
	private VerificationState verificationState = VerificationState.UNVERIFIED;

	@Column(name = "archived_at")
	private Instant archivedAt;

	/** Set by Hibernate at insert; DB now() default remains for raw seed SQL. */
	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(nullable = false)
	private int version;

	protected Organization() {}

	public Organization(String name, OrganizationType type) {
		this.name = name;
		this.type = type;
	}

	public UUID getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public OrganizationType getType() {
		return type;
	}

	public void setType(OrganizationType type) {
		this.type = type;
	}

	public String getDomain() {
		return domain;
	}

	public void setDomain(String domain) {
		this.domain = domain;
	}

	public Provenance getProvenance() {
		return provenance;
	}

	public void setProvenance(Provenance provenance) {
		this.provenance = provenance;
	}

	public VerificationState getVerificationState() {
		return verificationState;
	}

	public void setVerificationState(VerificationState verificationState) {
		this.verificationState = verificationState;
	}

	public Instant getArchivedAt() {
		return archivedAt;
	}

	public void setArchivedAt(Instant archivedAt) {
		this.archivedAt = archivedAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public int getVersion() {
		return version;
	}
}
