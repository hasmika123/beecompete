package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.ImportOrigin;
import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.domain.ImportStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

/**
 * Native-SQL implementation of {@link ImportRecordSearch}.
 *
 * <p>Native because the two things curators actually filter and sort on — the extracted competition
 * name and its slug — live inside the JSONB {@code payload} column, which JPQL cannot address. The
 * WHERE clause is assembled from fixed fragments and the ORDER BY comes from
 * {@link ImportRecordSort}; every caller-supplied value is a bound parameter, so no request text
 * ever reaches the SQL string.
 */
public class ImportRecordSearchImpl implements ImportRecordSearch {

	@PersistenceContext
	private EntityManager entityManager;

	@Override
	@Transactional(readOnly = true)
	public Page<ImportRecord> search(ImportStatus status, ImportOrigin origin, String text, ImportRecordSort sort,
			boolean descending, Pageable pageable) {
		String search = text == null || text.isBlank() ? null : "%" + text.trim() + "%";

		StringBuilder where = new StringBuilder(" WHERE r.status = :status");
		if (origin != null) {
			where.append(" AND r.origin = :origin");
		}
		if (search != null) {
			where.append(" AND (r.payload->>'name' ILIKE :text OR r.payload->>'slug' ILIKE :text"
					+ " OR r.payload->>'organizerName' ILIKE :text OR r.source_url ILIKE :text)");
		}
		// NULLS LAST in both directions (Postgres defaults to NULLS FIRST on DESC): an unscored
		// user request must never outrank a scored extraction just because it has no confidence.
		// created_at breaks ties so paging stays stable across requests.
		String order = " ORDER BY " + sort.expression() + (descending ? " DESC" : " ASC")
				+ " NULLS LAST, r.created_at DESC, r.id";

		Query rows = entityManager.createNativeQuery("SELECT r.* FROM import_record r" + where + order,
				ImportRecord.class);
		Query count = entityManager.createNativeQuery("SELECT count(*) FROM import_record r" + where);
		for (Query query : List.of(rows, count)) {
			query.setParameter("status", status.name());
			if (origin != null) {
				query.setParameter("origin", origin.name());
			}
			if (search != null) {
				query.setParameter("text", search);
			}
		}

		rows.setFirstResult((int) pageable.getOffset());
		rows.setMaxResults(pageable.getPageSize());
		@SuppressWarnings("unchecked")
		List<ImportRecord> content = rows.getResultList();
		long total = ((Number) count.getSingleResult()).longValue();
		return new PageImpl<>(content, pageable, total);
	}
}
