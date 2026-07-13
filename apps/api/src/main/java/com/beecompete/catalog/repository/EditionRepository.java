package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.Edition;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EditionRepository extends JpaRepository<Edition, UUID> {

	List<Edition> findByCompetitionId(UUID competitionId);

	/** Public detail (R1-4): live editions, oldest cycle first. */
	List<Edition> findByCompetitionIdAndArchivedAtIsNullOrderByCreatedAt(UUID competitionId);

	/** Corrections-queue subject names: one query, competition join-fetched (no lazy N+1). */
	@Query("select e from Edition e join fetch e.competition where e.id in :ids")
	List<Edition> findAllWithCompetitionByIdIn(@Param("ids") Collection<UUID> ids);

	/**
	 * Bump an edition's {@code updated_at} (R1-10 sitemap lastmod). KeyDate rows have no
	 * {@code updated_at} of their own, so a key-date write touches its parent edition here — that
	 * stamp then feeds the sitemap's GREATEST() so a corrected deadline still moves {@code
	 * <lastmod>}. A bulk update (not a dirtied entity) since {@code updated_at} is
	 * {@code @UpdateTimestamp}-managed and only fires on entity merge.
	 */
	@Modifying
	@Query("update Edition e set e.updatedAt = :now where e.id = :id")
	void touchUpdatedAt(@Param("id") UUID id, @Param("now") Instant now);
}
