package com.beecompete.catalog.service;

import com.beecompete.catalog.repository.CategoryTemplateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Validates a Competition's {@code attributes} bag against its Category Template's JSON Schema
 * (domain-model D1 — the mechanism that keeps "standardized yet flexible" honest). Every write
 * path that touches {@code attributes} goes through this: the admin tool (R1-3) and the S3
 * extraction pipeline. Server-side validation is the real gate (CLAUDE.md); client mirrors are UX.
 *
 * <p>Rules: {@code null} attributes = valid (the bag is optional); a category with no template =
 * valid (permissive until a template is curated); otherwise the schema decides.
 */
@Service
public class CategoryAttributeValidator {

	private static final JsonSchemaFactory SCHEMA_FACTORY =
			JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);

	private final CategoryTemplateRepository templates;
	private final ObjectMapper mapper;

	public CategoryAttributeValidator(CategoryTemplateRepository templates, ObjectMapper mapper) {
		this.templates = templates;
		this.mapper = mapper;
	}

	/**
	 * @return validation problems, empty when the bag conforms (or no template exists).
	 */
	@Transactional(readOnly = true)
	public List<String> validate(UUID categoryId, Map<String, Object> attributes) {
		if (attributes == null || attributes.isEmpty()) {
			return List.of();
		}
		return templates
				.findByCategoryId(categoryId)
				.map(template -> {
					JsonSchema schema = SCHEMA_FACTORY.getSchema(mapper.valueToTree(template.getJsonSchema()));
					return schema.validate(mapper.<com.fasterxml.jackson.databind.JsonNode>valueToTree(attributes))
							.stream()
							.map(ValidationMessage::getMessage)
							.toList();
				})
				.orElseGet(List::of);
	}
}
