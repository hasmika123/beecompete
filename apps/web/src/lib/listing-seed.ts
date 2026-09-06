/**
 * A SAVED listing → the competition form's seed (owner 2026-09-05).
 *
 * WHY THIS EXISTS: reviewing a submitted listing used to mean a page that looked nothing like the
 * form it was typed into — competition fields on one tab, the season a click away on another page,
 * FAQ and prep resources as delete-only lists. The listing page now renders the SAME stepper form
 * the create flow uses, and this module is what feeds it: the competition, its current season, the
 * season's timeline and regions, the awards rows, and the resources + FAQ rows, read into the exact
 * seed shape a pasted payload or a queued extraction already produces (`lib/import-seed`).
 *
 * Two things a saved listing has that an extraction does not, both carried on the seed:
 *  - **Row ids** on key dates, resources and FAQs, so a save updates rows in place and a removed
 *    row is deleted by id — never "delete everything, recreate everything".
 *  - **The season's other attributes** (`keepAttributes`), which the form has no control for and
 *    must not drop when it writes the awards back.
 *
 * Pure, so it is tested; the page calls it server-side and ships the seed with the HTML.
 */

import { instantToZonedWallClock, keyDateZone } from '@/lib/dates';
import type { AwardJson } from '@/lib/competition-payload';
import type { ImportSeed } from '@/lib/import-seed';
import type { Competition, Edition, Faq, KeyDate, Resource } from '@/lib/admin-types';

/**
 * Which season the listing page edits — the newest live one.
 *
 * Newest by cycle label (numeric-aware, so "2026" outranks "2025" and "2025-26" sorts as a
 * string beside them), with the run status as the tie-break: an OPEN season beats a CLOSED one
 * carrying the same label. Archived seasons never qualify — the public gate ignores them, so a
 * reviewer should not be editing one under the impression it is what visitors see. Null when the
 * listing has no live season at all, which the form treats as "add one" (the readiness gate hides
 * a listing with none — domain-model §8a).
 *
 * Every other season stays reachable from the page's season strip and keeps its own edit page.
 */
export function currentEdition(editions: Edition[]): Edition | null {
  const STATUS_RANK: Record<string, number> = {
    OPEN: 0,
    ONGOING: 1,
    UPCOMING: 2,
    CLOSED: 3,
    ARCHIVED: 4,
  };
  const live = editions.filter((e) => e.archivedAt == null);
  live.sort((a, b) => {
    const byLabel = b.cycleLabel.localeCompare(a.cycleLabel, 'en', { numeric: true });
    if (byLabel !== 0) return byLabel;
    return (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
  });
  return live[0] ?? null;
}

export interface ListingSeedInput {
  competition: Competition;
  /** The season the form edits ({@link currentEdition}); null seeds an empty "add a season". */
  edition: Edition | null;
  keyDates: KeyDate[];
  regionIds: string[];
  resources: Resource[];
  faqs: Faq[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** The saved awards rows, or undefined when the season predates the rows editor. */
function awardsOf(bag: Record<string, unknown>): AwardJson[] | undefined {
  const rows = bag.awards;
  if (!Array.isArray(rows)) return undefined;
  const kept = rows.filter((r): r is AwardJson => isRecord(r) && typeof r.title === 'string');
  return kept.length > 0 ? kept : undefined;
}

export function seedFromListing({
  competition: c,
  edition: e,
  keyDates,
  regionIds,
  resources,
  faqs,
}: ListingSeedInput): ImportSeed {
  const bag = isRecord(e?.attributes) ? e.attributes : {};
  const { awards: _awards, prize_display_mode: storedMode, ...keepAttributes } = bag;

  return {
    competition: {
      name: c.name,
      slug: c.slug,
      categoryId: c.categoryId,
      organizerOrgId: c.organizerOrgId,
      officialUrl: c.officialUrl,
      logo: c.logo,
      description: c.description,
      tags: c.tags,
      participationMode: c.participationMode,
      delivery: c.delivery,
      entryPathways: c.entryPathways ?? [],
      costType: c.costType,
      recurrence: c.recurrence,
      evaluationType: c.evaluationType,
      eligibilityBasis: c.eligibilityBasis,
      teamSizeMin: c.teamSizeMin,
      teamSizeMax: c.teamSizeMax,
      minGrade: c.minGrade,
      maxGrade: c.maxGrade,
      minAge: c.minAge,
      maxAge: c.maxAge,
      attributes: c.attributes,
    },
    edition: e && {
      cycleLabel: e.cycleLabel,
      status: e.status,
      scopeLevel: e.scopeLevel,
      registrationUrl: e.registrationUrl ?? '',
      entryFee: e.entryFee != null ? String(e.entryFee) : '',
      currency: e.currency ?? '',
      prizeSummary: e.prizeSummary ?? '',
      prizeValue: e.prizeValue != null ? String(e.prizeValue) : '',
      prizeCurrency: e.prizeCurrency ?? '',
      ageCutoffDate: e.ageCutoffDate ?? '',
      awards: awardsOf(bag),
      prizeDisplayMode: typeof storedMode === 'string' ? storedMode : undefined,
      advancesToEditionId: e.advancesToEditionId,
      keepAttributes,
    },
    // Shown as the wall clock in the row's OWN zone — the day the curator typed, not the server's
    // reading of it. A row with no zone reads in UTC (`keyDateZone`), the same rule the public
    // timeline applies, so the form and the listing show the same calendar day.
    keyDates: keyDates.map((k) => {
      const zone = keyDateZone(k.timezone);
      const wall = instantToZonedWallClock(k.startsAt, zone);
      const endWall = instantToZonedWallClock(k.endsAt, zone);
      return {
        id: k.id,
        type: k.type,
        date: wall ? wall.slice(0, 10) : '',
        endDate: endWall ? endWall.slice(0, 10) : '',
        time: wall ? wall.slice(11, 16) : '',
        timezone: zone,
        tbd: wall === null,
        label: k.label ?? '',
      };
    }),
    resources: [...resources]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        type: r.type,
        isAffiliate: r.isAffiliate,
        imageUrl: r.imageUrl ?? '',
      })),
    faqs: [...faqs]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
    regionIds,
    organizerName: null,
    extras: { competition: {}, edition: {} },
  };
}
