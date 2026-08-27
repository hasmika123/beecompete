import type { CompetitionDetail, CompetitionSummary, EditionView } from '@/lib/catalog-types';

// Ranking for the detail page's "More competitions" row (owner 2026-08-26, #109 — supersedes
// R1's plain same-category-newest pick).
//
// The goal is a row that is FULL and as SPECIFIC as possible: always try to show the same number
// of cards, preferring competitions that share more with the one being viewed. The owner's
// priority order is category > organizer > grade band > location, applied lexicographically —
// every same-category candidate is scored on (organizer, grade, location) matches and sorted so
// that a candidate keeping a higher-priority match ALWAYS outranks one that lost it, whatever
// the lower-priority fields say. That is exactly "use all fields first, drop the least important
// field when the list runs short": the sort walks tiers org+grade+loc → org+grade → org →
// category-only without ever re-fetching.
//
// Category is not a score bit — it is the POOL. Candidates come from a same-category search, and
// only when that pool cannot fill the row does the caller top up from an unfiltered search (the
// "lost category too" tier), so a category match always beats a non-match. Still short after
// that means the whole catalog is nearly empty — R1's five-listing reality — and the row simply
// shows what exists.
//
// Deliberately NOT personalized: this is a fact about the LISTINGS ("by the same organizer, for
// your grades, near you" as properties of the card), not about the visitor. Visitor-aware
// recommendations stay R2-15 (M25).

/** How many cards the row aims to show — the "same amount most of the time" target. */
export const RELATED_TARGET = 4;

/**
 * Grade bands overlap. A null bound means unbounded on that side (the catalog's "all grades"
 * encoding), so a competition with no grade data overlaps everything — it can never LOSE a slot
 * for grade reasons, which errs toward fuller rows on sparse data.
 */
export function gradesOverlap(
  a: CompetitionSummary | CompetitionDetail,
  b: CompetitionSummary,
): boolean {
  const aMin = a.minGrade ?? -1;
  const aMax = a.maxGrade ?? 12;
  const bMin = b.minGrade ?? -1;
  const bMax = b.maxGrade ?? 12;
  return aMin <= bMax && bMin <= aMax;
}

/**
 * Location match: a shared region name, or both online. Region NAMES rather than ids because the
 * summary DTO exposes exactly that (the distinct names across live editions); the detail page's
 * side comes from its current edition. An in-person competition with no curated regions matches
 * nothing — absent data narrows this one field rather than wildcarding it, because "near you"
 * is the claim a wrong match would make, and it is the only one of the three that is a claim
 * about geography rather than a bounded fact.
 */
export function locationsMatch(
  current: { delivery: string; regionNames: readonly string[] },
  candidate: CompetitionSummary,
): boolean {
  if (current.delivery === 'virtual' && candidate.delivery === 'virtual') return true;
  return current.regionNames.some((name) => candidate.regions.includes(name));
}

/** The page competition's region names — its current edition's, the ones the visitor is shown. */
export function currentRegionNames(edition: EditionView | undefined): string[] {
  return (edition?.regions ?? []).map((r) => r.name);
}

/**
 * Order a same-category pool by specificity against the viewed competition and take the best
 * `target`. Ties keep the pool's incoming order (the search's `newest` sort), so the row stays
 * stable between renders of the same data.
 */
export function rankRelated(
  current: CompetitionDetail,
  currentEditionRegions: string[],
  pool: CompetitionSummary[],
  target: number = RELATED_TARGET,
): CompetitionSummary[] {
  const orgName = current.organizer?.name ?? null;
  const forLocation = { delivery: current.delivery, regionNames: currentEditionRegions };

  const score = (c: CompetitionSummary): number => {
    // Lexicographic via bit weights: org (4) > grade (2) > location (1). A candidate that keeps
    // the organizer match outranks any that lost it regardless of the other two, and so on down.
    let s = 0;
    if (orgName !== null && c.organizer?.name === orgName) s += 4;
    if (gradesOverlap(current, c)) s += 2;
    if (locationsMatch(forLocation, c)) s += 1;
    return s;
  };

  return pool
    .filter((c) => c.id !== current.id)
    .map((c, i) => ({ c, s: score(c), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, target)
    .map((x) => x.c);
}

/**
 * Merge the ranked same-category picks with an unfiltered top-up, dropping duplicates and self.
 * The top-up goes strictly AFTER the ranked picks — losing the category match is the last resort,
 * below every same-category candidate however little else it shares.
 */
export function topUpRelated(
  picked: CompetitionSummary[],
  extras: CompetitionSummary[],
  excludeId: string,
  target: number = RELATED_TARGET,
): CompetitionSummary[] {
  const seen = new Set(picked.map((c) => c.id));
  seen.add(excludeId);
  const out = [...picked];
  for (const c of extras) {
    if (out.length >= target) break;
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}
