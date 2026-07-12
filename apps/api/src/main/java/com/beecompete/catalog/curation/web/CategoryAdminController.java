package com.beecompete.catalog.curation.web;

import com.beecompete.catalog.domain.Category;
import com.beecompete.catalog.domain.CategoryTemplate;
import com.beecompete.catalog.repository.CategoryRepository;
import com.beecompete.catalog.repository.CategoryTemplateRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * R1-3 admin CRUD for the Category taxonomy + Category Templates. The taxonomy grows freely
 * (Q1 — seed config, not schema); template JSON-Schema edits are how validation tightens over
 * time (never migrations). Category delete is a hard delete guarded by the DB FK — a category
 * with competitions cannot be removed.
 */
@RestController
@RequestMapping("/api/v1/admin/categories")
@Transactional
public class CategoryAdminController {

	private final CategoryRepository categories;
	private final CategoryTemplateRepository templates;

	public CategoryAdminController(CategoryRepository categories, CategoryTemplateRepository templates) {
		this.categories = categories;
		this.templates = templates;
	}

	@GetMapping
	@Transactional(readOnly = true)
	public List<CategoryResponse> list() {
		return categories.findAll().stream().map(CategoryResponse::from).toList();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public CategoryResponse create(@Valid @RequestBody CategoryRequest request) {
		Category category = new Category(request.name(), request.slug());
		category.setParent(resolveParent(request.parentId()));
		return CategoryResponse.from(categories.save(category));
	}

	@PutMapping("/{id}")
	public CategoryResponse update(@PathVariable UUID id, @Valid @RequestBody CategoryRequest request) {
		Category category = require(id);
		category.setName(request.name());
		category.setSlug(request.slug());
		category.setParent(resolveParent(request.parentId()));
		return CategoryResponse.from(category);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable UUID id) {
		templates.findByCategoryId(id).ifPresent(templates::delete);
		categories.deleteById(id); // FK restricts if competitions still reference it
	}

	// --- Category Template (the JSON Schema behind attributes validation — D1) ---

	@GetMapping("/{id}/template")
	@Transactional(readOnly = true)
	public TemplateResponse getTemplate(@PathVariable UUID id) {
		require(id);
		return templates.findByCategoryId(id).map(TemplateResponse::from).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "no template for category"));
	}

	@PutMapping("/{id}/template")
	public TemplateResponse putTemplate(@PathVariable UUID id, @Valid @RequestBody TemplateRequest request) {
		Category category = require(id);
		CategoryTemplate template = templates.findByCategoryId(id).orElseGet(
				() -> new CategoryTemplate(category, request.jsonSchema()));
		template.setJsonSchema(request.jsonSchema());
		template.setUiHints(request.uiHints());
		return TemplateResponse.from(templates.save(template));
	}

	private Category resolveParent(UUID parentId) {
		if (parentId == null) {
			return null;
		}
		return categories.findById(parentId).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "unknown parent category"));
	}

	private Category require(UUID id) {
		return categories.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "category not found"));
	}

	public record CategoryRequest(UUID parentId, @NotBlank @Size(max = 120) String name,
			@NotBlank @Size(max = 140) @Pattern(regexp = "[a-z0-9]+(-[a-z0-9]+)*",
					message = "slug must be lowercase kebab-case") String slug) {}

	public record CategoryResponse(UUID id, UUID parentId, String name, String slug) {
		static CategoryResponse from(Category c) {
			return new CategoryResponse(c.getId(), c.getParent() != null ? c.getParent().getId() : null,
					c.getName(), c.getSlug());
		}
	}

	public record TemplateRequest(@NotNull Map<String, Object> jsonSchema, Map<String, Object> uiHints) {}

	public record TemplateResponse(UUID id, UUID categoryId, Map<String, Object> jsonSchema,
			Map<String, Object> uiHints) {
		static TemplateResponse from(CategoryTemplate t) {
			return new TemplateResponse(t.getId(), t.getCategory().getId(), t.getJsonSchema(), t.getUiHints());
		}
	}
}
