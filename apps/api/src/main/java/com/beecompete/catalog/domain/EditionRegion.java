package com.beecompete.catalog.domain;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

/**
 * Join: which Regions an Edition covers (Q3 locked — the region join is Edition-level, never
 * Competition-level). Rule: one registration = one Edition; one Edition may be tagged with many
 * regions (e.g. AMC 10 2026 nationwide). Modeled as an explicit entity (not a bare {@code @ManyToMany})
 * so future join attributes can be added additively.
 */
@Entity
@Table(name = "edition_region")
public class EditionRegion {

	@EmbeddedId
	private EditionRegionId id;

	@MapsId("editionId")
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "edition_id", nullable = false)
	private Edition edition;

	@MapsId("regionId")
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "region_id", nullable = false)
	private Region region;

	protected EditionRegion() {}

	public EditionRegion(Edition edition, Region region) {
		this.edition = edition;
		this.region = region;
		this.id = new EditionRegionId(edition.getId(), region.getId());
	}

	public EditionRegionId getId() {
		return id;
	}

	public Edition getEdition() {
		return edition;
	}

	public Region getRegion() {
		return region;
	}
}
