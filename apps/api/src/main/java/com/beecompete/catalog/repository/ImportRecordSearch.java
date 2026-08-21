package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.ImportOrigin;
import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.domain.ImportStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Filter + sort for the import-review queue — a custom repository fragment because both live on the
 * JSONB payload ({@code payload->>'name'}), which derived query methods can't reach.
 */
public interface ImportRecordSearch {

	/**
	 * One page of the queue.
	 *
	 * @param status the lifecycle bucket being reviewed (required — the queue is always one tab)
	 * @param origin PIPELINE / USER_REQUEST, or null for both
	 * @param text case-insensitive substring over the extracted name, slug, organizer name and
	 * source URL; null or blank matches everything
	 * @param sort which column to order by
	 * @param descending sort direction; NULLs always sort last
	 * @param pageable paging only — its {@code Sort} is ignored in favour of the two arguments above
	 */
	Page<ImportRecord> search(ImportStatus status, ImportOrigin origin, String text, ImportRecordSort sort,
			boolean descending, Pageable pageable);
}
