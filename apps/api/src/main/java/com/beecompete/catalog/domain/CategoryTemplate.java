package com.beecompete.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * The JSON Schema that validates a Competition's {@code attributes} bag for a given Category
 * (glossary: Category Template — the "standardized yet flexible" mechanism, domain-model D1).
 */
@Entity
@Table(name = "category_template")
public class CategoryTemplate {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "category_id", nullable = false)
	private Category category;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "json_schema", nullable = false)
	private Map<String, Object> jsonSchema;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "ui_hints")
	private Map<String, Object> uiHints;

	protected CategoryTemplate() {}

	public CategoryTemplate(Category category, Map<String, Object> jsonSchema) {
		this.category = category;
		this.jsonSchema = jsonSchema;
	}

	public UUID getId() {
		return id;
	}

	public Category getCategory() {
		return category;
	}

	public void setCategory(Category category) {
		this.category = category;
	}

	public Map<String, Object> getJsonSchema() {
		return jsonSchema;
	}

	public void setJsonSchema(Map<String, Object> jsonSchema) {
		this.jsonSchema = jsonSchema;
	}

	public Map<String, Object> getUiHints() {
		return uiHints;
	}

	public void setUiHints(Map<String, Object> uiHints) {
		this.uiHints = uiHints;
	}
}
