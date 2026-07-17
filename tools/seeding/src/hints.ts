import { CATEGORY_IDS, type CategorySlug } from './categories.ts';
import type { CompetitionPayload, SeedHints } from './types.ts';

/**
 * Flagging (#1) for the S4 curator: compares the extraction against the S2 master-index hints and
 * returns a warning per disagreement. We only flag the HIGH-SIGNAL, low-ambiguity fields — cost,
 * participation, entry pathway, category — where a mismatch is a clear "look twice" (e.g. the page
 * read FREE but our index says paid). Grade band is fed to the model as a hint but deliberately NOT
 * flagged: parsing "K-8"/"Pre-K-2" into a range is too error-prone to trust as a flag.
 *
 * These are the SAME hints that guided the extraction — a surviving mismatch means the page text
 * genuinely contradicted the index (page wins, curator verifies), which is exactly worth surfacing.
 */
const idToSlug = new Map<string, CategorySlug>(
  (Object.entries(CATEGORY_IDS) as [CategorySlug, string][]).map(([slug, id]) => [id, slug]),
);

const norm = (s: string | null | undefined): string | undefined => {
  const t = s?.trim().toLowerCase();
  return t ? t : undefined;
};

/** Collapse inner whitespace runs to a single space (organizer names vary in spacing). */
const collapseWs = (s: string | undefined): string | undefined =>
  s === undefined ? undefined : s.replace(/\s+/g, ' ');

export function compareHints(payload: CompetitionPayload, hints: SeedHints): string[] {
  const warnings: string[] = [];

  const cost = norm(hints.cost);
  const extractedCost = norm(payload.costType);
  if ((cost === 'free' || cost === 'paid') && extractedCost && extractedCost !== cost) {
    warnings.push(
      `cost mismatch: index hint "${cost}" vs extracted ${payload.costType} — verify the entry fee`,
    );
  }

  const part = norm(hints.participation);
  const extractedPart = norm(payload.participationMode);
  if (
    part &&
    ['individual', 'team', 'both'].includes(part) &&
    extractedPart &&
    extractedPart !== part
  ) {
    warnings.push(
      `participation mismatch: index hint "${part}" vs extracted ${payload.participationMode} — verify`,
    );
  }

  const path = norm(hints.entryPathway);
  const extractedPath = norm(payload.entryPathway);
  if (
    path &&
    ['individual', 'school_or_chapter', 'either'].includes(path) &&
    extractedPath &&
    extractedPath !== path
  ) {
    warnings.push(
      `entry-pathway mismatch: index hint "${path}" vs extracted ${payload.entryPathway} — verify`,
    );
  }

  const cat = norm(hints.categorySlug);
  const extractedSlug = payload.categoryId ? idToSlug.get(payload.categoryId) : undefined;
  if (cat && extractedSlug && extractedSlug !== cat) {
    warnings.push(
      `category mismatch: index hint "${cat}" vs extracted "${extractedSlug}" — verify best-fit category`,
    );
  }

  // Organizer: case-insensitive, whitespace-collapsed compare of the extracted name vs the index
  // hint. Only flagged when BOTH are present — a page that named NO organizer is surfaced by the
  // pipeline's "no organizer extracted" warning instead, not as a mismatch.
  const orgHint = collapseWs(norm(hints.organizer));
  const extractedOrg = collapseWs(norm(payload.organizerName));
  if (orgHint && extractedOrg && orgHint !== extractedOrg) {
    warnings.push(
      `organizer mismatch: index hint "${hints.organizer}" vs extracted "${payload.organizerName}" — verify`,
    );
  }

  return warnings;
}
