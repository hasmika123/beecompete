package com.beecompete.catalog.service;

import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.CostType;
import com.beecompete.catalog.domain.Delivery;
import com.beecompete.catalog.domain.EntryPathway;
import com.beecompete.catalog.domain.ParticipationMode;
import com.beecompete.catalog.domain.Region;
import com.beecompete.catalog.repository.CategoryRepository;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.RegionRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * R1-5 search & filter (X10, M2, M3, M4): keyword search over the generated
 * {@code search_vector} (Postgres FTS, websearch syntax) OR-ed with a pg_trgm similarity match
 * on the name for typo tolerance; faceted filters per the Page-2 blueprint; sorts. Native SQL —
 * FTS/trigram/lateral have no JPQL form — returning ids + the computed next deadline, then
 * hydrating entities through the normal repository.
 *
 * <p>Semantics worth naming:
 * <ul>
 * <li><b>Grade</b> = range overlap; a null bound on the record means open on that side.</li>
 * <li><b>participation/pathway are eligibility questions</b>, not exact matches: filtering
 * "individual" includes BOTH/EITHER records — a parent asks "can my kid enter this way?".</li>
 * <li><b>next deadline</b> = earliest FUTURE {@code REG_CLOSE} across live editions (matches
 * the {@link EffectiveStatus} deadline notion). Deadline sort puts no-deadline records last.</li>
 * <li><b>Facet counts</b> (Grade + Category only, per blueprint) exclude the facet's own
 * filter, so the user sees what switching within the facet would yield.</li>
 * <li><b>Popularity sort (M4) is deferred</b> — the signal (M31 save counts) arrives at R2-10.</li>
 * </ul>
 */
@Service
public class CompetitionSearchService {

	public enum SortOption { RELEVANCE, NAME, NEWEST, DEADLINE }

	/** Raw filter values as the public API receives them (category = slug, region = id-or-code). */
	public record Criteria(String query, String categorySlug, Short minGrade, Short maxGrade,
			String region, CostType costType, Delivery delivery, ParticipationMode participation,
			EntryPathway entryPathway, List<String> evaluationTypes, Integer deadlineWithinDays,
			SortOption sort, boolean includeFacets, int page, int size) {

		public boolean hasQuery() {
			return query != null && !query.isBlank();
		}
	}

	/**
	 * One result row + the card facts derived from child rows (M5): next deadline, the prize
	 * line of the most recent live edition, and the distinct region names across live editions.
	 */
	public record Item(Competition competition, Instant nextDeadline, String prizeSummary,
			List<String> regions) {}

	public record CategoryFacet(String slug, String name, long count) {}

	public record GradeFacet(short grade, long count) {}

	public record Facets(List<CategoryFacet> categories, List<GradeFacet> grades) {}

	public record Result(List<Item> items, long total, int page, int size, Facets facets) {}

	/** A region that has at least one live listing — the filter panel's option source. */
	public record RegionOption(UUID id, String level, String name, String code, long count) {}

	private static final String DEADLINE_LATERAL = """
			 LEFT JOIN LATERAL (
			   SELECT min(kd.starts_at) AS next_deadline
			   FROM edition e2 JOIN key_date kd ON kd.edition_id = e2.id
			   WHERE e2.competition_id = c.id AND e2.archived_at IS NULL
			     AND kd.type = 'REG_CLOSE' AND kd.starts_at > :now
			 ) d ON true
			""";

	private final EntityManager em;
	private final CompetitionRepository competitions;
	private final CategoryRepository categories;
	private final RegionRepository regions;

	public CompetitionSearchService(EntityManager em, CompetitionRepository competitions,
			CategoryRepository categories, RegionRepository regions) {
		this.em = em;
		this.competitions = competitions;
		this.categories = categories;
		this.regions = regions;
	}

	@Transactional(readOnly = true)
	public Result search(Criteria criteria) {
		UUID categoryId = null;
		if (criteria.categorySlug() != null && !criteria.categorySlug().isBlank()) {
			var category = categories.findBySlug(criteria.categorySlug());
			if (category.isEmpty()) {
				return empty(criteria); // unknown filter value = no matches, not an error
			}
			categoryId = category.get().getId();
		}
		List<UUID> regionIds = null;
		if (criteria.region() != null && !criteria.region().isBlank()) {
			regionIds = resolveRegionIds(criteria.region());
			if (regionIds.isEmpty()) {
				return empty(criteria);
			}
		}
		Instant now = Instant.now();

		Where where = where(criteria, categoryId, regionIds, now, null);
		long total = count(criteria, where);
		List<Item> items = total == 0 ? List.of() : fetchPage(criteria, where, now);
		Facets facets = criteria.includeFacets()
				? new Facets(categoryFacet(criteria, categoryId, regionIds, now),
						gradeFacet(criteria, categoryId, regionIds, now))
				: null;
		return new Result(items, total, criteria.page(), criteria.size(), facets);
	}

	// --- query assembly ---

	private record Where(String sql, Map<String, Object> params, boolean needsLateral) {}

	/** Builds the WHERE clause; {@code exclude} drops one facet dimension (standard facet counting). */
	private Where where(Criteria c, UUID categoryId, List<UUID> regionIds, Instant now, String exclude) {
		StringBuilder sql = new StringBuilder("c.archived_at IS NULL");
		Map<String, Object> params = new HashMap<>();
		boolean needsLateral = false;

		if (c.hasQuery()) {
			// word_similarity (not whole-string similarity): a short, possibly misspelled query
			// should match its best word-span in the name, not be diluted by the name's length.
			sql.append(" AND (c.search_vector @@ websearch_to_tsquery('english', :q)")
					.append(" OR word_similarity(lower(:q), lower(c.name)) >= 0.3)");
			params.put("q", c.query().trim());
		}
		if (categoryId != null && !"category".equals(exclude)) {
			sql.append(" AND c.category_id = :categoryId");
			params.put("categoryId", categoryId);
		}
		if (!"grade".equals(exclude)) {
			if (c.minGrade() != null) {
				sql.append(" AND (c.max_grade IS NULL OR c.max_grade >= :minGrade)");
				params.put("minGrade", c.minGrade());
			}
			if (c.maxGrade() != null) {
				sql.append(" AND (c.min_grade IS NULL OR c.min_grade <= :maxGrade)");
				params.put("maxGrade", c.maxGrade());
			}
		}
		if (regionIds != null) {
			sql.append(" AND EXISTS (SELECT 1 FROM edition e JOIN edition_region er ON er.edition_id = e.id")
					.append(" WHERE e.competition_id = c.id AND e.archived_at IS NULL")
					.append(" AND er.region_id IN (:regionIds))");
			params.put("regionIds", regionIds);
		}
		if (c.costType() != null) {
			sql.append(" AND c.cost_type = :costType");
			params.put("costType", c.costType().name());
		}
		if (c.delivery() != null) {
			sql.append(" AND c.delivery = :delivery");
			params.put("delivery", c.delivery().name());
		}
		if (c.participation() != null) {
			sql.append(" AND c.participation_mode IN ('BOTH', :participation)");
			params.put("participation", c.participation().name());
		}
		if (c.entryPathway() != null) {
			sql.append(" AND c.entry_pathway IN ('EITHER', :pathway)");
			params.put("pathway", c.entryPathway().name());
		}
		if (c.evaluationTypes() != null && !c.evaluationTypes().isEmpty()) {
			List<String> placeholders = new ArrayList<>();
			for (int i = 0; i < c.evaluationTypes().size(); i++) {
				placeholders.add(":ev" + i);
				params.put("ev" + i, c.evaluationTypes().get(i));
			}
			sql.append(" AND c.evaluation_type && CAST(ARRAY[")
					.append(String.join(", ", placeholders)).append("] AS text[])");
		}
		if (c.deadlineWithinDays() != null) {
			sql.append(" AND d.next_deadline IS NOT NULL AND d.next_deadline <= :deadlineCutoff");
			params.put("deadlineCutoff", now.plus(c.deadlineWithinDays(), ChronoUnit.DAYS));
			params.put("now", now);
			needsLateral = true;
		}
		return new Where(sql.toString(), params, needsLateral);
	}

	private long count(Criteria criteria, Where where) {
		String sql = "SELECT count(*) FROM competition c"
				+ (where.needsLateral() ? DEADLINE_LATERAL : "")
				+ " WHERE " + where.sql();
		return ((Number) bind(sql, where.params()).getSingleResult()).longValue();
	}

	private List<Item> fetchPage(Criteria criteria, Where where, Instant now) {
		// The item rows always carry the next deadline (cards render it), so the lateral is
		// always present here — add :now if the deadline filter didn't already.
		Map<String, Object> params = new HashMap<>(where.params());
		params.put("now", now);
		String sql = "SELECT c.id, d.next_deadline FROM competition c" + DEADLINE_LATERAL
				+ " WHERE " + where.sql()
				+ " ORDER BY " + orderBy(criteria)
				+ " LIMIT :limit OFFSET :offset";
		params.put("limit", criteria.size());
		params.put("offset", (long) criteria.page() * criteria.size());

		@SuppressWarnings("unchecked")
		List<Object[]> rows = bind(sql, params).getResultList();
		List<UUID> ids = rows.stream().map(row -> asUuid(row[0])).toList();
		Map<UUID, Competition> byId = new HashMap<>();
		competitions.findAllById(ids).forEach(comp -> byId.put(comp.getId(), comp));
		Map<UUID, String> prizes = prizeSummaries(ids);
		Map<UUID, List<String>> regionNames = regionNames(ids);
		List<Item> items = new ArrayList<>();
		for (Object[] row : rows) {
			UUID id = asUuid(row[0]);
			Competition competition = byId.get(id);
			if (competition != null) { // row deleted between the two queries — skip, don't 500
				items.add(new Item(competition, asInstant(row[1]), prizes.get(id),
						regionNames.getOrDefault(id, List.of())));
			}
		}
		return items;
	}

	/** Prize line of the most recently created live edition per competition (decision #23 — card fact). */
	private Map<UUID, String> prizeSummaries(List<UUID> ids) {
		if (ids.isEmpty()) {
			return Map.of();
		}
		String sql = "SELECT DISTINCT ON (e.competition_id) e.competition_id, e.prize_summary"
				+ " FROM edition e WHERE e.competition_id IN (:ids) AND e.archived_at IS NULL"
				+ " AND e.prize_summary IS NOT NULL ORDER BY e.competition_id, e.created_at DESC";
		Map<UUID, String> result = new HashMap<>();
		mapRows(sql, Map.of("ids", ids), row -> result.put(asUuid(row[0]), (String) row[1]));
		return result;
	}

	/** Distinct region names across live editions per competition (card fact; empty = unspecified). */
	private Map<UUID, List<String>> regionNames(List<UUID> ids) {
		if (ids.isEmpty()) {
			return Map.of();
		}
		String sql = "SELECT DISTINCT e.competition_id, r.name"
				+ " FROM edition e JOIN edition_region er ON er.edition_id = e.id"
				+ " JOIN region r ON r.id = er.region_id"
				+ " WHERE e.competition_id IN (:ids) AND e.archived_at IS NULL"
				+ " ORDER BY e.competition_id, r.name";
		Map<UUID, List<String>> result = new HashMap<>();
		mapRows(sql, Map.of("ids", ids),
				row -> result.computeIfAbsent(asUuid(row[0]), k -> new ArrayList<>()).add((String) row[1]));
		return result;
	}

	private String orderBy(Criteria criteria) {
		SortOption sort = criteria.sort();
		if (sort == SortOption.RELEVANCE && !criteria.hasQuery()) {
			sort = SortOption.NAME; // relevance is meaningless without a query
		}
		return switch (sort) {
			case RELEVANCE -> "(ts_rank(c.search_vector, websearch_to_tsquery('english', :q))"
					+ " + word_similarity(lower(:q), lower(c.name))) DESC, lower(c.name)";
			case NAME -> "lower(c.name)";
			case NEWEST -> "c.created_at DESC, lower(c.name)";
			case DEADLINE -> "d.next_deadline ASC NULLS LAST, lower(c.name)";
		};
	}

	private List<CategoryFacet> categoryFacet(Criteria c, UUID categoryId, List<UUID> regionIds, Instant now) {
		Where where = where(c, categoryId, regionIds, now, "category");
		String sql = "SELECT cat.slug, cat.name, count(*) FROM competition c"
				+ " JOIN category cat ON cat.id = c.category_id"
				+ (where.needsLateral() ? DEADLINE_LATERAL : "")
				+ " WHERE " + where.sql()
				+ " GROUP BY cat.slug, cat.name ORDER BY cat.name";
		return mapRows(sql, where.params(),
				row -> new CategoryFacet((String) row[0], (String) row[1], ((Number) row[2]).longValue()));
	}

	private List<GradeFacet> gradeFacet(Criteria c, UUID categoryId, List<UUID> regionIds, Instant now) {
		Where where = where(c, categoryId, regionIds, now, "grade");
		String sql = "SELECT gs.grade, count(*) FROM competition c"
				+ (where.needsLateral() ? DEADLINE_LATERAL : "")
				+ " JOIN generate_series(-1, 12) AS gs(grade)"
				+ " ON (c.min_grade IS NULL OR c.min_grade <= gs.grade)"
				+ " AND (c.max_grade IS NULL OR c.max_grade >= gs.grade)"
				+ " WHERE " + where.sql()
				+ " GROUP BY gs.grade ORDER BY gs.grade";
		return mapRows(sql, where.params(),
				row -> new GradeFacet(((Number) row[0]).shortValue(), ((Number) row[1]).longValue()));
	}

	/** A category with its live-listing count (Page-5 tiles + hero category strip). */
	public record CategoryOption(String slug, String name, long count) {}

	/** All categories with live-listing counts (zero included — the taxonomy is the fixed Q1 list). */
	@Transactional(readOnly = true)
	public List<CategoryOption> categoryOptions() {
		String sql = "SELECT cat.slug, cat.name, count(c.id) FROM category cat"
				+ " LEFT JOIN competition c ON c.category_id = cat.id AND c.archived_at IS NULL"
				+ " GROUP BY cat.slug, cat.name ORDER BY cat.name";
		return mapRows(sql, Map.of(), row -> new CategoryOption((String) row[0], (String) row[1],
				((Number) row[2]).longValue()));
	}

	/**
	 * Card items for an explicit id list (the landing Featured carousel, M36) — same card facts
	 * as a search page, id order preserved, archived rows silently dropped.
	 */
	@Transactional(readOnly = true)
	public List<Item> itemsByIds(List<UUID> ids) {
		if (ids.isEmpty()) {
			return List.of();
		}
		Map<UUID, Competition> byId = new HashMap<>();
		competitions.findAllById(ids).forEach(comp -> {
			if (comp.getArchivedAt() == null) {
				byId.put(comp.getId(), comp);
			}
		});
		Map<UUID, Instant> deadlines = nextDeadlines(ids);
		Map<UUID, String> prizes = prizeSummaries(ids);
		Map<UUID, List<String>> regionsById = regionNames(ids);
		List<Item> items = new ArrayList<>();
		for (UUID id : ids) {
			Competition competition = byId.get(id);
			if (competition != null) {
				items.add(new Item(competition, deadlines.get(id), prizes.get(id),
						regionsById.getOrDefault(id, List.of())));
			}
		}
		return items;
	}

	/** Earliest FUTURE REG_CLOSE per competition (same deadline notion as the search lateral). */
	private Map<UUID, Instant> nextDeadlines(List<UUID> ids) {
		String sql = "SELECT e.competition_id, min(kd.starts_at)"
				+ " FROM edition e JOIN key_date kd ON kd.edition_id = e.id"
				+ " WHERE e.competition_id IN (:ids) AND e.archived_at IS NULL"
				+ " AND kd.type = 'REG_CLOSE' AND kd.starts_at > :now GROUP BY e.competition_id";
		Map<UUID, Instant> result = new HashMap<>();
		mapRows(sql, Map.of("ids", ids, "now", Instant.now()),
				row -> result.put(asUuid(row[0]), asInstant(row[1])));
		return result;
	}

	/** Regions carrying at least one live competition, with counts (filter panel + Page-5 tiles). */
	@Transactional(readOnly = true)
	public List<RegionOption> regionOptions() {
		String sql = "SELECT r.id, r.level, r.name, r.code, count(DISTINCT c.id)"
				+ " FROM region r JOIN edition_region er ON er.region_id = r.id"
				+ " JOIN edition e ON e.id = er.edition_id"
				+ " JOIN competition c ON c.id = e.competition_id"
				+ " WHERE e.archived_at IS NULL AND c.archived_at IS NULL"
				+ " GROUP BY r.id, r.level, r.name, r.code ORDER BY r.name";
		return mapRows(sql, Map.of(), row -> new RegionOption(asUuid(row[0]),
				String.valueOf(row[1]).toLowerCase(java.util.Locale.ROOT), (String) row[2],
				(String) row[3], ((Number) row[4]).longValue()));
	}

	// --- plumbing ---

	private Query bind(String sql, Map<String, Object> params) {
		Query query = em.createNativeQuery(sql);
		params.forEach(query::setParameter);
		return query;
	}

	private <T> List<T> mapRows(String sql, Map<String, Object> params, Function<Object[], T> mapper) {
		@SuppressWarnings("unchecked")
		List<Object[]> rows = bind(sql, params).getResultList();
		return rows.stream().map(mapper).toList();
	}

	private List<UUID> resolveRegionIds(String region) {
		try {
			return List.of(UUID.fromString(region));
		} catch (IllegalArgumentException e) {
			return regions.findByCodeIgnoreCase(region).stream().map(Region::getId).toList();
		}
	}

	private Result empty(Criteria criteria) {
		return new Result(List.of(), 0, criteria.page(), criteria.size(),
				criteria.includeFacets() ? new Facets(List.of(), List.of()) : null);
	}

	private static UUID asUuid(Object value) {
		return value instanceof UUID uuid ? uuid : UUID.fromString(String.valueOf(value));
	}

	private static Instant asInstant(Object value) {
		return switch (value) {
			case null -> null;
			case Instant instant -> instant;
			case OffsetDateTime odt -> odt.toInstant();
			case Timestamp ts -> ts.toInstant();
			default -> throw new IllegalStateException("unexpected timestamp type: " + value.getClass());
		};
	}
}
