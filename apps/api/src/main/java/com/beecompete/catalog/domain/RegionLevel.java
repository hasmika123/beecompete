package com.beecompete.catalog.domain;

/**
 * Level of a structured geo node (Country → State → County → City), plus the special
 * "Virtual/Online" region (domain-model Q3) so virtual Editions can be tagged with a region row.
 */
public enum RegionLevel {
	COUNTRY,
	STATE,
	COUNTY,
	CITY,
	VIRTUAL
}
