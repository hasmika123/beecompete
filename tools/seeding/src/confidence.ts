import type { CompetitionPayload, Extraction } from './types.ts';

/**
 * Final confidence in [0,1], rounded to 2 dp (server stores a BigDecimal 0.00..1.00).
 *
 * PENALTY-ONLY blending (H3): the model's self-reported confidence can only LOWER the score,
 * never raise it — `min(completeness, blend(completeness, model))`. The self-report comes out
 * of an LLM that just read an arbitrary web page, so a page that instructs the model to claim
 * `modelConfidence: 1.0` cannot inflate the queue-triage ranking or the provenance confidence
 * that is stamped onto the public record on approve. A LOW self-report still drags the score
 * down, which is the useful half of the signal.
 *
 * This is intentionally a transparent heuristic for v0 — it ranks records for the S4 review
 * queue (curators triage low-confidence rows first); it is NOT a correctness guarantee.
 */
export function scoreConfidence(extraction: Extraction): number {
  const completeness = completenessScore(extraction.payload);
  const model = extraction.modelConfidence;
  const blended = model === undefined ? completeness : 0.5 * completeness + 0.5 * model;
  return round2(clampUnit(Math.min(completeness, blended)));
}

/** Fraction of weighted, high-signal fields that are populated. */
function completenessScore(p: CompetitionPayload): number {
  const checks: [number, boolean][] = [
    [2, typeof p.name === 'string' && Boolean(p.name.trim())],
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
  return (
    p.attributes != null &&
    typeof p.attributes === 'object' &&
    !Array.isArray(p.attributes) &&
    Object.keys(p.attributes).length > 0
  );
}

function clampUnit(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
