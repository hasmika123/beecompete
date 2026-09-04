package com.beecompete.catalog.curation;

import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.ImportRecordRepository;
import com.beecompete.catalog.repository.OrganizationRepository;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Finds duplicate candidates for a competition or an organization about to be written (DQ4
 * Phase-1 slice, {@code docs/duplicate-detection-plan.md}). ONE place computes it, and everything
 * that needs the answer asks here: the write gates in {@link CompetitionCurationService} and the
 * organization admin endpoints, the two {@code /duplicates} lookups the admin forms call before
 * submit, the import queue's flags, and the seeding tool's pre-check.
 *
 * <p><b>Where the matching happens.</b> In SQL, against the generated {@code name_key} /
 * {@code url_key} columns (migration {@code 0026}). This service never normalizes a name or URL
 * itself — a raw value goes in as a bind parameter and the database keys it with the same function
 * that keyed the stored rows, so the two sides cannot disagree. Reasons are assembled here from
 * boolean columns the queries return.
 *
 * <p><b>Exact vs soft.</b> {@link MatchReason#NAME_EXACT} / {@link MatchReason#URL_EXACT} (and
 * {@link MatchReason#DOMAIN_EXACT} for organizations) mean the identity keys agree.
 * {@link MatchReason#NAME_SIMILAR} is trigram similarity at or above
 * {@link #SIMILARITY_THRESHOLD}, or one name key containing the other. Callers decide what each
 * reason costs — the write gate treats a LIVE exact-name match as a hard 409 (the partial unique
 * index {@code uq_competition_name_key_live} backs it), everything else as a 422 the curator can
 * override.
 */
@Service
public class DuplicateDetectionService {

	/**
	 * Whole-string {@code pg_trgm} similarity at or above this is a "similar name". 0.45 flags
	 * "AMC 8" / "AMC 10" and "National Science Bowl" / "National Science Bee" (which a curator
	 * should look at) while leaving "Science Olympiad" / "Science Bowl" alone. A soft signal only
	 * — it never blocks without a human saying so — so erring towards flagging is the right side.
	 */
	public static final double SIMILARITY_THRESHOLD = 0.45;

	/** At most this many candidates per lookup — a panel a curator reads, not a report. */
	static final int LIMIT = 10;

	/**
	 * Stand-in for "exclude nothing". A null bind parameter in {@code c.id <> :excludeId} makes the
	 * whole predicate NULL and excludes every row, so the queries take a UUID that matches nothing.
	 */
	static final UUID NO_EXCLUSION = new UUID(0L, 0L);

	private final CompetitionRepository competitions;
	private final ImportRecordRepository importRecords;
	private final OrganizationRepository organizations;

	public DuplicateDetectionService(CompetitionRepository competitions, ImportRecordRepository importRecords,
			OrganizationRepository organizations) {
		this.competitions = competitions;
		this.importRecords = importRecords;
		this.organizations = organizations;
	}

	// --- competitions ---

	/**
	 * Full detection for a competition described by its raw values — the write gate, the admin
	 * form's pre-submit check, and the seeding tool's "is this already listed" question.
	 *
	 * @param excludeCompetitionId the row being edited (never its own duplicate); null on create
	 * @param excludeImportRecordId the queue record being reviewed (never its own twin); null otherwise
	 */
	@Transactional(readOnly = true)
	public CompetitionDuplicates findCompetition(String name, String officialUrl, String slug,
			UUID excludeCompetitionId, UUID excludeImportRecordId) {
		String safeName = blankToEmpty(name);
		String safeUrl = blankToEmpty(officialUrl);
		String safeSlug = blankToEmpty(slug);
		List<CompetitionCandidate> catalog = new ArrayList<>();
		if (!safeName.isEmpty() || !safeUrl.isEmpty() || !safeSlug.isEmpty()) {
			for (CompetitionRepository.DuplicateCandidateView row : competitions.findDuplicateCandidates(safeName,
					safeUrl, safeSlug, orNoExclusion(excludeCompetitionId), SIMILARITY_THRESHOLD, LIMIT)) {
				catalog.add(toCandidate(row));
			}
		}
		List<PendingTwin> pending = new ArrayList<>();
		if (!safeName.isEmpty() || !safeUrl.isEmpty()) {
			for (ImportRecordRepository.PendingTwinView row : importRecords.findPendingTwins(safeName, safeUrl,
					orNoExclusion(excludeImportRecordId), LIMIT)) {
				List<MatchReason> reasons = new ArrayList<>(2);
				if (Boolean.TRUE.equals(row.getNameExact())) {
					reasons.add(MatchReason.NAME_EXACT);
				}
				if (Boolean.TRUE.equals(row.getUrlExact())) {
					reasons.add(MatchReason.URL_EXACT);
				}
				pending.add(new PendingTwin(row.getId(), row.getName(), row.getSourceUrl(), row.getCreatedAt(), reasons));
			}
		}
		catalog.sort(CANDIDATE_ORDER);
		return new CompetitionDuplicates(catalog, pending);
	}

	/** Full detection for a queued record, from the values in its payload. */
	@Transactional(readOnly = true)
	public CompetitionDuplicates findForImportRecord(ImportRecord record) {
		Map<String, Object> payload = record.getPayload();
		String url = text(payload, "officialUrl");
		// The page we actually fetched is as much "this competition's URL" as what the extractor
		// read off it — and for a front-door page the two often differ.
		if (url == null) {
			url = record.getSourceUrl();
		}
		return findCompetition(text(payload, "name"), url, text(payload, "slug"), null, record.getId());
	}

	/**
	 * The cheap signals for a PAGE of queue records — exact keys and the slug, joined in SQL, plus
	 * how many other PENDING records look like the same competition. No trigram work here: the
	 * list is scanned, the review page (which runs {@link #findForImportRecord}) is read.
	 */
	@Transactional(readOnly = true)
	public Map<UUID, RecordDuplicateSummary> summarizeImportRecords(Collection<UUID> recordIds) {
		if (recordIds.isEmpty()) {
			return Map.of();
		}
		Map<UUID, List<CompetitionCandidate>> byRecord = new HashMap<>();
		for (CompetitionRepository.RecordCollisionView row : competitions.findCollisionsForImportRecords(recordIds)) {
			byRecord.computeIfAbsent(row.getRecordId(), k -> new ArrayList<>()).add(toCandidate(row));
		}
		Map<UUID, Integer> twins = new HashMap<>();
		for (ImportRecordRepository.PendingTwinCountView row : importRecords.countPendingTwins(recordIds)) {
			twins.put(row.getRecordId(), row.getTwins().intValue());
		}
		Map<UUID, RecordDuplicateSummary> out = new HashMap<>();
		for (UUID id : recordIds) {
			List<CompetitionCandidate> candidates = byRecord.get(id);
			CompetitionCandidate best = null;
			if (candidates != null) {
				candidates.sort(CANDIDATE_ORDER);
				best = candidates.get(0);
			}
			out.put(id, new RecordDuplicateSummary(best, twins.getOrDefault(id, 0)));
		}
		return out;
	}

	// --- organizations ---

	/**
	 * Duplicate candidates for an organization: same name key, same registrable domain, similar
	 * name (trigram or containment either way — the containment rule is the one the organizer
	 * resolver has always applied, widened to both directions as the admin form already did).
	 */
	@Transactional(readOnly = true)
	public List<OrganizationCandidate> findOrganization(String name, String domain, UUID excludeId) {
		String safeName = blankToEmpty(name);
		String safeDomain = blankToEmpty(domain);
		if (safeName.isEmpty() && safeDomain.isEmpty()) {
			return List.of();
		}
		List<OrganizationCandidate> out = new ArrayList<>();
		for (OrganizationRepository.DuplicateCandidateView row : organizations.findDuplicateCandidates(safeName,
				safeDomain, orNoExclusion(excludeId), SIMILARITY_THRESHOLD, LIMIT)) {
			List<MatchReason> reasons = new ArrayList<>(3);
			if (Boolean.TRUE.equals(row.getNameExact())) {
				reasons.add(MatchReason.NAME_EXACT);
			}
			if (Boolean.TRUE.equals(row.getDomainExact())) {
				reasons.add(MatchReason.DOMAIN_EXACT);
			}
			if (!reasons.contains(MatchReason.NAME_EXACT) && (Boolean.TRUE.equals(row.getContains())
					|| (row.getSimilarity() != null && row.getSimilarity() >= SIMILARITY_THRESHOLD))) {
				reasons.add(MatchReason.NAME_SIMILAR);
			}
			out.add(new OrganizationCandidate(row.getId(), row.getName(), row.getType(), row.getDomain(),
					row.getArchivedAt(), reasons));
		}
		out.sort(Comparator.comparing((OrganizationCandidate c) -> !c.isLiveExact())
				.thenComparing(c -> !c.reasons().contains(MatchReason.NAME_EXACT))
				.thenComparing(c -> !c.reasons().contains(MatchReason.DOMAIN_EXACT)));
		return out;
	}

	// --- shared ---

	/** Live exact matches first, then exact-but-archived, then URL-only, then slug, then similar. */
	private static final Comparator<CompetitionCandidate> CANDIDATE_ORDER = Comparator
			.comparing((CompetitionCandidate c) -> !c.isLiveNameExact())
			.thenComparing(c -> !c.reasons().contains(MatchReason.NAME_EXACT))
			.thenComparing(c -> !c.reasons().contains(MatchReason.URL_EXACT))
			.thenComparing(c -> !c.reasons().contains(MatchReason.SLUG_TAKEN));

	private static CompetitionCandidate toCandidate(CompetitionRepository.CandidateSignals row) {
		List<MatchReason> reasons = new ArrayList<>(4);
		if (Boolean.TRUE.equals(row.getNameExact())) {
			reasons.add(MatchReason.NAME_EXACT);
		}
		if (Boolean.TRUE.equals(row.getUrlExact())) {
			reasons.add(MatchReason.URL_EXACT);
		}
		if (Boolean.TRUE.equals(row.getSlugTaken())) {
			reasons.add(MatchReason.SLUG_TAKEN);
		}
		// A row that matched only on similarity/containment — or on those PLUS an exact key, in
		// which case "similar" adds nothing a curator needs to read.
		if (!reasons.contains(MatchReason.NAME_EXACT) && (Boolean.TRUE.equals(row.getContains())
				|| (row.getSimilarity() != null && row.getSimilarity() >= SIMILARITY_THRESHOLD))) {
			reasons.add(MatchReason.NAME_SIMILAR);
		}
		return new CompetitionCandidate(row.getId(), row.getSlug(), row.getName(), row.getOrganizerName(),
				row.getListingStatus(), row.getArchivedAt(), reasons);
	}

	private static UUID orNoExclusion(UUID id) {
		return id != null ? id : NO_EXCLUSION;
	}

	/**
	 * Null/blank → "" for binding: {@code catalog_name_key('')} is NULL, and NULL never equals a
	 * key, so an absent value simply matches nothing — without a null parameter reaching a native
	 * query, where its type can't be inferred.
	 */
	private static String blankToEmpty(String value) {
		return value == null || value.isBlank() ? "" : value.trim();
	}

	private static String text(Map<String, Object> payload, String key) {
		Object value = payload == null ? null : payload.get(key);
		return value instanceof String s && !s.isBlank() ? s : null;
	}

	// --- results (serialized as-is by the admin API) ---

	/** An existing competition that may be the one being written. */
	public record CompetitionCandidate(UUID id, String slug, String name, String organizerName,
			String listingStatus, Instant archivedAt, List<MatchReason> reasons) {

		/** The one combination the write gate refuses outright — the unique index would too. */
		@JsonIgnore
		public boolean isLiveNameExact() {
			return archivedAt == null && reasons.contains(MatchReason.NAME_EXACT);
		}

		@JsonIgnore
		public boolean isExact() {
			return reasons.contains(MatchReason.NAME_EXACT) || reasons.contains(MatchReason.URL_EXACT);
		}
	}

	/** A PENDING import record that looks like the same competition — "someone already queued this". */
	public record PendingTwin(UUID importRecordId, String name, String sourceUrl, Instant createdAt,
			List<MatchReason> reasons) {}

	public record CompetitionDuplicates(List<CompetitionCandidate> catalog, List<PendingTwin> pending) {

		@JsonIgnore
		public boolean isEmpty() {
			return catalog.isEmpty() && pending.isEmpty();
		}

		/** The strongest catalog match, for a one-line flag. */
		@JsonIgnore
		public CompetitionCandidate best() {
			return catalog.isEmpty() ? null : catalog.get(0);
		}
	}

	/** The queue list's per-row flag: the strongest catalog match + how many pending twins. */
	public record RecordDuplicateSummary(CompetitionCandidate duplicate, int pendingTwins) {}

	public record OrganizationCandidate(UUID id, String name, String type, String domain, Instant archivedAt,
			List<MatchReason> reasons) {

		@JsonIgnore
		public boolean isLiveExact() {
			return archivedAt == null && reasons.contains(MatchReason.NAME_EXACT);
		}

		@JsonIgnore
		public boolean isNameExact() {
			return reasons.contains(MatchReason.NAME_EXACT);
		}
	}

	/** Used by tests and the gates to print a candidate list into an error reason. */
	public static String describe(List<CompetitionCandidate> candidates) {
		StringBuilder sb = new StringBuilder();
		for (CompetitionCandidate c : candidates) {
			if (sb.length() > 0) {
				sb.append(", ");
			}
			sb.append(c.name()).append(" [").append(c.slug()).append("] (")
					.append(String.join("+", c.reasons().stream().map(Enum::name).toList()));
			if (c.archivedAt() != null) {
				sb.append(", archived");
			}
			sb.append(')');
		}
		return sb.toString();
	}

	public static String describeOrganizations(List<OrganizationCandidate> candidates) {
		StringBuilder sb = new StringBuilder();
		for (OrganizationCandidate c : candidates) {
			if (sb.length() > 0) {
				sb.append(", ");
			}
			sb.append(c.id()).append(" · ").append(c.name()).append(" (")
					.append(String.join("+", c.reasons().stream().map(Enum::name).toList()));
			if (c.archivedAt() != null) {
				sb.append(", archived");
			}
			sb.append(')');
		}
		return sb.toString();
	}

	public static boolean sameText(String a, String b) {
		return Objects.equals(a == null ? null : a.trim(), b == null ? null : b.trim());
	}
}
