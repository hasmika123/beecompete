import type { CompetitionPayload, Extraction } from './types.ts';

/**
 * Final confidence in [0,1], rounded to 2 dp (server stores a BigDecimal 0.00..1.00). It blends:
 *   - completeness: how many high-value Spine fields the extraction actually filled, and
 *   - the model's self-reported confidence (when present).
 * This is intentionally a transparent heuristic for v0 — it ranks records for the S4 review queue
 * (curators triage low-confidence rows first); it is NOT a correctness guarantee.
 */
export function scoreConfidence(extraction: Extraction): number {
  const completeness = completenessScore(extraction.payload);
  const model = extraction.modelConfidence;
  const blended = model === undefined ? completeness : 0.5 * completeness + 0.5 * model;
  return round2(clampUnit(blended));
}

/** Fraction of weighted, high-signal fields that are populated. */
function completenessScore(p: CompetitionPayload): number {
  const checks: [number, boolean][] = [
    [2, Boolean(p.name?.trim())],
    [2, Boolean(p.slug)],
    [2, Boolean(p.categoryId)],
    [1, p.participationMode != null],
    [1, p.delivery != null],
    [1, p.entryPathway != null],
    [1, p.costType != null],
    [1, p.recurrence != null],
    [1, gradesOrAges(p)],
    [1, Array.isArray(p.evaluationType) && p.evaluationType.length > 0],
    [1, hasAttributes(p)],
    [1, Boolean(p.officialUrl)],
  ];
  const total = checks.reduce((sum, [w]) => sum + w, 0);
  const got = checks.reduce((sum, [w, ok]) => sum + (ok ? w : 0), 0);
  return got / total;
}

function gradesOrAges(p: CompetitionPayload): boolean {
  return p.minGrade != null || p.maxGrade != null || p.minAge != null || p.maxAge != null;
}

function hasAttributes(p: CompetitionPayload): boolean {
  return p.attributes != null && Object.keys(p.attributes).length > 0;
}

function clampUnit(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
