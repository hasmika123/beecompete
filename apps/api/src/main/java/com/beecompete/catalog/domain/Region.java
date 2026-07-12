package com.beecompete.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * Structured geo node (Country → State → County → City), self-referencing via {@code parent}
 * (domain-model Q3). Editions attach to Regions through {@link EditionRegion}.
 */
@Entity
@Table(name = "region")
public class Region {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "parent_id")
	private Region parent;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private RegionLevel level;

	@NotBlank
	@Column(nullable = false, length = 160)
	private String name;

	@Column(length = 20)
	private String code;

	protected Region() {}

	public Region(RegionLevel level, String name) {
		this.level = level;
		this.name = name;
	}

	public UUID getId() {
		return id;
	}

	public Region getParent() {
		return parent;
	}

	public void setParent(Region parent) {
		this.parent = parent;
	}

	public RegionLevel getLevel() {
		return level;
	}

	public void setLevel(RegionLevel level) {
		this.level = level;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getCode() {
		return code;
	}

	public void setCode(String code) {
		this.code = code;
	}
}
