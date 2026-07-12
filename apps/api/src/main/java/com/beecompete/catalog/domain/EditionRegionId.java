package com.beecompete.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Composite key for {@link EditionRegion} — (edition_id, region_id). */
@Embeddable
public class EditionRegionId implements Serializable {

	@Column(name = "edition_id")
	private UUID editionId;

	@Column(name = "region_id")
	private UUID regionId;

	protected EditionRegionId() {}

	public EditionRegionId(UUID editionId, UUID regionId) {
		this.editionId = editionId;
		this.regionId = regionId;
	}

	public UUID getEditionId() {
		return editionId;
	}

	public UUID getRegionId() {
		return regionId;
	}

	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (!(o instanceof EditionRegionId that)) {
			return false;
		}
		return Objects.equals(editionId, that.editionId) && Objects.equals(regionId, that.regionId);
	}

	@Override
	public int hashCode() {
		return Objects.hash(editionId, regionId);
	}
}
