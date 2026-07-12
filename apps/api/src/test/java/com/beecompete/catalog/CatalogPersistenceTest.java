package com.beecompete.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.beecompete.TestcontainersConfiguration;
import com.beecompete.catalog.domain.Category;
import com.beecompete.catalog.domain.CategoryTemplate;
import com.beecompete.catalog.domain.Competition;
import com.beecompete.catalog.domain.CompetitionFaq;
import com.beecompete.catalog.domain.CorrectionProposal;
import com.beecompete.catalog.domain.CorrectionStatus;
import com.beecompete.catalog.domain.CorrectionSubjectType;
import com.beecompete.catalog.domain.CostType;
import com.beecompete.catalog.domain.Delivery;
import com.beecompete.catalog.domain.Edition;
import com.beecompete.catalog.domain.EditionRegion;
import com.beecompete.catalog.domain.EditionStatus;
import com.beecompete.catalog.domain.EntryPathway;
import com.beecompete.catalog.domain.FeaturedSlot;
import com.beecompete.catalog.domain.HeroCard;
import com.beecompete.catalog.domain.HeroCardPosition;
import com.beecompete.catalog.domain.KeyDate;
import com.beecompete.catalog.domain.KeyDateType;
import com.beecompete.catalog.domain.ParticipationMode;
import com.beecompete.catalog.domain.Provenance;
import com.beecompete.catalog.domain.ProvenanceSource;
import com.beecompete.catalog.domain.Recurrence;
import com.beecompete.catalog.domain.Region;
import com.beecompete.catalog.domain.RegionLevel;
import com.beecompete.catalog.domain.Resource;
import com.beecompete.catalog.domain.ResourceType;
import com.beecompete.catalog.domain.ScopeLevel;
import com.beecompete.catalog.domain.VerificationState;
import com.beecompete.catalog.repository.CategoryRepository;
import com.beecompete.catalog.repository.CategoryTemplateRepository;
import com.beecompete.catalog.repository.CompetitionFaqRepository;
import com.beecompete.catalog.repository.CompetitionRepository;
import com.beecompete.catalog.repository.CorrectionProposalRepository;
import com.beecompete.catalog.repository.EditionRegionRepository;
import com.beecompete.catalog.repository.EditionRepository;
import com.beecompete.catalog.repository.FeaturedSlotRepository;
import com.beecompete.catalog.repository.HeroCardRepository;
import com.beecompete.catalog.repository.KeyDateRepository;
import com.beecompete.catalog.repository.RegionRepository;
import com.beecompete.catalog.repository.ResourceRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/**
 * Proves the R1-1 migration and the JPA mapping agree end-to-end on a real Postgres (Testcontainers,
 * via {@link TestcontainersConfiguration}) with the schema created by Liquibase. Persists a
 * Competition → Edition → KeyDate → EditionRegion graph plus Resource / FAQ / correction / landing
 * content, then flushes + clears the persistence context and re-reads, so every assertion is a true
 * DB round-trip — exercising JSONB, {@code text[]} arrays, enums, the embedded provenance, and the
 * DB-generated {@code created_at} default.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Transactional
class CatalogPersistenceTest {

	@Autowired
	private EntityManager em;

	@Autowired
	private CategoryRepository categories;

	@Autowired
	private CategoryTemplateRepository categoryTemplates;

	@Autowired
	private CompetitionRepository competitions;

	@Autowired
	private EditionRepository editions;

	@Autowired
	private KeyDateRepository keyDates;

	@Autowired
	private RegionRepository regions;

	@Autowired
	private EditionRegionRepository editionRegions;

	@Autowired
	private ResourceRepository resources;

	@Autowired
	private CompetitionFaqRepository faqs;

	@Autowired
	private CorrectionProposalRepository corrections;

	@Autowired
	private HeroCardRepository heroCards;

	@Autowired
	private FeaturedSlotRepository featuredSlots;

	@Test
	void persistsAndReadsBackTheCoreCatalogGraph() {
		Category math = categories.save(new Category("Math", "math"));

		CategoryTemplate mathTemplate = new CategoryTemplate(math,
				Map.of("type", "object", "properties", Map.of("syllabus", Map.of("type", "string"))));
		mathTemplate.setUiHints(Map.of("syllabus", Map.of("widget", "textarea")));
		categoryTemplates.save(mathTemplate);

		Competition amc = new Competition("amc-10", "AMC 10", math, ParticipationMode.INDIVIDUAL,
				Delivery.IN_PERSON, EntryPathway.SCHOOL_OR_CHAPTER, CostType.PAID, Recurrence.ANNUAL);
		amc.setMinGrade((short) 9);
		amc.setMaxGrade((short) 10);
		amc.setTags(List.of("math", "olympiad"));
		amc.setEvaluationType(List.of("exam"));
		amc.setAttributes(Map.of("difficulty", "hard", "rounds", 1));
		amc.setProvenance(new Provenance(ProvenanceSource.IMPORT, Instant.parse("2026-07-01T00:00:00Z"),
				new BigDecimal("0.90")));
		amc = competitions.save(amc);

		Edition amc2026 = new Edition(amc, "2026", EditionStatus.UPCOMING, ScopeLevel.NATIONAL);
		amc2026.setEntryFee(new BigDecimal("2.50"));
		amc2026.setCurrency("USD");
		amc2026.setAgeCutoffDate(LocalDate.of(2026, 6, 1));
		amc2026.setPrizeSummary("Certificates + AIME invitation");
		amc2026.setAttributes(Map.of("aime_cutoff", "top 2.5%"));
		amc2026 = editions.save(amc2026);

		KeyDate regClose = keyDates.save(new KeyDate(amc2026, KeyDateType.REG_CLOSE,
				Instant.parse("2026-10-15T23:59:00Z")));
		regClose.setTimezone("America/New_York");

		Region usa = new Region(RegionLevel.COUNTRY, "United States");
		usa.setCode("US");
		usa = regions.save(usa);
		editionRegions.save(new EditionRegion(amc2026, usa));

		Resource guide = new Resource(amc, "Art of Problem Solving", "https://aops.com", ResourceType.GUIDE);
		guide.setAffiliate(true);
		guide.setAffiliateMeta(Map.of("network", "amazon", "tag", "beecompete-20"));
		resources.save(guide);

		faqs.save(new CompetitionFaq(amc, "Can homeschoolers enter?",
				"Yes — through a registered testing site.", (short) 0));

		corrections.save(new CorrectionProposal(CorrectionSubjectType.COMPETITION, amc.getId(),
				Map.of("official_url", "https://maa.org/amc")));

		heroCards.save(new HeroCard(HeroCardPosition.MAIN, "hero/main.jpg", "Students competing"));
		featuredSlots.save(new FeaturedSlot(amc, (short) 1));

		// Force a real DB round-trip: nothing below reads from the first-level cache.
		em.flush();
		// @CreationTimestamp must populate created_at in memory at insert — R1-4's
		// create-then-return endpoints depend on it without a reload.
		assertThat(amc.getCreatedAt()).isNotNull();
		em.clear();

		Competition reloaded = competitions.findBySlug("amc-10").orElseThrow();
		assertThat(reloaded.getName()).isEqualTo("AMC 10");
		assertThat(reloaded.getCategory().getSlug()).isEqualTo("math");
		assertThat(categoryTemplates.findByCategoryId(reloaded.getCategory().getId()))
				.get()
				.satisfies(t -> assertThat(t.getJsonSchema()).containsEntry("type", "object")); // jsonb
		assertThat(reloaded.getParticipationMode()).isEqualTo(ParticipationMode.INDIVIDUAL);
		assertThat(reloaded.getEntryPathway()).isEqualTo(EntryPathway.SCHOOL_OR_CHAPTER);
		assertThat(reloaded.getVerificationState()).isEqualTo(VerificationState.UNVERIFIED); // default
		assertThat(reloaded.getMinGrade()).isEqualTo((short) 9);
		assertThat(reloaded.getTags()).containsExactly("math", "olympiad"); // text[]
		assertThat(reloaded.getEvaluationType()).containsExactly("exam"); // text[]
		assertThat(reloaded.getAttributes()).containsEntry("difficulty", "hard"); // jsonb
		assertThat(reloaded.getProvenance().getSource()).isEqualTo(ProvenanceSource.IMPORT); // embedded
		assertThat(reloaded.getProvenance().getConfidence()).isEqualByComparingTo("0.90");
		assertThat(reloaded.getCreatedAt()).isNotNull(); // DB default now()
		assertThat(reloaded.getArchivedAt()).isNull(); // not soft-deleted

		List<Edition> ed = editions.findByCompetitionId(reloaded.getId());
		assertThat(ed).hasSize(1);
		Edition e = ed.get(0);
		assertThat(e.getStatus()).isEqualTo(EditionStatus.UPCOMING);
		assertThat(e.getScopeLevel()).isEqualTo(ScopeLevel.NATIONAL);
		assertThat(e.getEntryFee()).isEqualByComparingTo("2.50");
		assertThat(e.getAgeCutoffDate()).isEqualTo(LocalDate.of(2026, 6, 1));
		assertThat(e.getAttributes()).containsEntry("aime_cutoff", "top 2.5%");

		List<KeyDate> kd = keyDates.findByEditionIdOrderByStartsAt(e.getId());
		assertThat(kd).singleElement()
				.satisfies(k -> assertThat(k.getType()).isEqualTo(KeyDateType.REG_CLOSE));

		assertThat(editionRegions.findByEditionId(e.getId()))
				.singleElement()
				.satisfies(er -> assertThat(er.getRegion().getCode()).isEqualTo("US"));

		assertThat(resources.findByCompetitionIdOrderByDisplayOrder(reloaded.getId()))
				.singleElement()
				.satisfies(r -> {
					assertThat(r.isAffiliate()).isTrue();
					assertThat(r.getAffiliateMeta()).containsEntry("network", "amazon"); // jsonb
				});

		assertThat(faqs.findByCompetitionIdOrderByDisplayOrder(reloaded.getId())).hasSize(1);

		assertThat(corrections.findByStatus(CorrectionStatus.PENDING)) // default status
				.anySatisfy(c -> assertThat(c.getSubjectId()).isEqualTo(reloaded.getId()));

		assertThat(heroCards.findByPosition(HeroCardPosition.MAIN)).isPresent();
		assertThat(featuredSlots.findAllByOrderByPosition()).hasSize(1);
	}
}
