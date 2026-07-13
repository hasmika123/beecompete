import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { CATEGORY_IDS, CATEGORY_TEMPLATES, type CategorySlug } from './categories.ts';
import {
  COST_TYPES,
  DELIVERIES,
  ENTRY_PATHWAYS,
  EVALUATION_TOKENS,
  PARTICIPATION_MODES,
  RECURRENCES,
  type CompetitionPayload,
} from './types.ts';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** Non-blocking review hints (e.g. team sizes on an INDIVIDUAL competition). */
  warnings: string[];
}

const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));

/** Compiled-validator cache — one ajv compile per category, not per record (L2). */
const compiledTemplates = new Map<CategorySlug, ValidateFunction>();

function templateValidator(slug: CategorySlug): ValidateFunction {
  let validate = compiledTemplates.get(slug);
  if (!validate) {
    validate = ajv.compile(CATEGORY_TEMPLATES[slug]);
    compiledTemplates.set(slug, validate);
  }
  return validate;
}

const idToSlug = new Map<string, CategorySlug>(
  (Object.entries(CATEGORY_IDS) as [CategorySlug, string][]).map(([slug, id]) => [id, slug]),
);

const MIN_GRADE = -1; // Pre-K
const MAX_GRADE = 12;
/** Server-side @Size cap on officialUrl / logo (CompetitionRequest) — mirrored here (M2). */
const MAX_URL_LENGTH = 1000;

/**
 * Validates a payload two ways:
 *   1. `attributes` against the correct Category Template JSON Schema (draft 2020-12) — the same
 *      schema apps/api re-checks on approve, so passing here means it won't bounce there.
 *   2. Spine sanity: required fields + TYPES (L3 — wrong-typed fields are errors, not crashes),
 *      enum tokens, grade encoding, age/team ranges, and http(s) URL fields ≤1000 chars (M2).
 * This is a pre-flight gate; the SERVER remains the source of truth (Bean Validation on approve).
 */
export function validatePayload(payload: CompetitionPayload): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  validateSpine(payload, errors, warnings);
  errors.push(...validateAttributes(payload));
  return { ok: errors.length === 0, errors, warnings };
}

function validateSpine(p: CompetitionPayload, errors: string[], warnings: string[]): void {
  if (typeof p.slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) {
    errors.push('slug must be non-empty lowercase kebab-case');
  } else if (p.slug.length > 160) {
    errors.push('slug exceeds 160 chars');
  }

  if (p.name != null && typeof p.name !== 'string') {
    errors.push('name must be a string');
  } else if (!p.name?.trim()) {
    errors.push('name is required');
  } else if (p.name.length > 300) {
    errors.push('name exceeds 300 chars');
  }

  if (p.summary != null && typeof p.summary !== 'string') {
    errors.push('summary must be a string');
  } else if (p.summary && p.summary.length > 300) {
    errors.push('summary exceeds 300 chars');
  }

  checkHttpUrl(errors, 'officialUrl', p.officialUrl);
  checkHttpUrl(errors, 'logo', p.logo);

  if (p.tags != null) {
    if (!Array.isArray(p.tags) || p.tags.some((t) => typeof t !== 'string')) {
      errors.push('tags must be an array of strings');
    }
  }

  if (!p.categoryId || !idToSlug.has(p.categoryId)) {
    errors.push(
      `categoryId must be one of the 11 seeded categories (got ${p.categoryId ?? 'null'})`,
    );
  }

  requireEnum(errors, 'participationMode', p.participationMode, PARTICIPATION_MODES);
  requireEnum(errors, 'delivery', p.delivery, DELIVERIES);
  requireEnum(errors, 'entryPathway', p.entryPathway, ENTRY_PATHWAYS);
  requireEnum(errors, 'costType', p.costType, COST_TYPES);
  requireEnum(errors, 'recurrence', p.recurrence, RECURRENCES);

  if (p.evaluationType != null) {
    if (!Array.isArray(p.evaluationType)) {
      errors.push('evaluationType must be an array of tokens');
    } else {
      const bad = p.evaluationType.filter((t) => !EVALUATION_TOKENS.includes(t as never));
      if (bad.length) {
        errors.push(
          `unknown evaluationType token(s): ${bad.join(', ')} — allowed: ${EVALUATION_TOKENS.join(', ')}`,
        );
      }
    }
  }

  // Numeric fields: wrong types are errors (L3), not silently skipped range checks.
  checkNumberType(errors, 'teamSizeMin', p.teamSizeMin);
  checkNumberType(errors, 'teamSizeMax', p.teamSizeMax);
  checkNumberType(errors, 'minGrade', p.minGrade);
  checkNumberType(errors, 'maxGrade', p.maxGrade);
  checkNumberType(errors, 'minAge', p.minAge);
  checkNumberType(errors, 'maxAge', p.maxAge);

  checkGrade(errors, 'minGrade', p.minGrade);
  checkGrade(errors, 'maxGrade', p.maxGrade);
  if (isNum(p.minGrade) && isNum(p.maxGrade) && p.minGrade > p.maxGrade) {
    errors.push(`minGrade (${p.minGrade}) must be <= maxGrade (${p.maxGrade})`);
  }
  if (isNum(p.minAge) && isNum(p.maxAge) && p.minAge > p.maxAge) {
    errors.push(`minAge (${p.minAge}) must be <= maxAge (${p.maxAge})`);
  }
  if (isNum(p.minAge) && p.minAge < 0) errors.push('minAge must be >= 0');
  if (isNum(p.maxAge) && p.maxAge < 0) errors.push('maxAge must be >= 0');
  if (isNum(p.teamSizeMin) && p.teamSizeMin < 1) errors.push('teamSizeMin must be >= 1');
  if (isNum(p.teamSizeMax) && p.teamSizeMax < 1) errors.push('teamSizeMax must be >= 1');
  if (isNum(p.teamSizeMin) && isNum(p.teamSizeMax) && p.teamSizeMin > p.teamSizeMax) {
    errors.push(`teamSizeMin (${p.teamSizeMin}) must be <= teamSizeMax (${p.teamSizeMax})`);
  }
  if (p.participationMode === 'INDIVIDUAL' && (p.teamSizeMin != null || p.teamSizeMax != null)) {
    warnings.push(
      'teamSizeMin/teamSizeMax are set but participationMode is INDIVIDUAL — check the extraction',
    );
  }

  if (p.attributes != null && (typeof p.attributes !== 'object' || Array.isArray(p.attributes))) {
    errors.push('attributes must be an object');
  }
}

function validateAttributes(p: CompetitionPayload): string[] {
  if (p.attributes == null || typeof p.attributes !== 'object' || Array.isArray(p.attributes)) {
    return []; // null is fine; a wrong type is already reported by the spine check
  }
  const slug = p.categoryId ? idToSlug.get(p.categoryId) : undefined;
  if (!slug) return []; // categoryId error already reported by the spine check
  const validate = templateValidator(slug);
  if (validate(p.attributes)) return [];
  return (validate.errors ?? []).map(
    (e) => `attributes${e.instancePath || ''} ${e.message ?? 'is invalid'}`,
  );
}

/** URL spine fields must be http(s), well-formed, and within the server's @Size cap (M2/H2). */
function checkHttpUrl(errors: string[], field: string, value: string | null | undefined): void {
  if (value == null) return;
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string URL`);
    return;
  }
  if (value.length > MAX_URL_LENGTH) {
    errors.push(`${field} exceeds ${MAX_URL_LENGTH} chars (server limit)`);
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    errors.push(`${field} is not a valid URL (got ${value})`);
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    errors.push(`${field} must be an http(s) URL (got ${parsed.protocol}//…)`);
  }
}

function checkNumberType(errors: string[], field: string, value: unknown): void {
  if (value != null && (typeof value !== 'number' || Number.isNaN(value))) {
    errors.push(`${field} must be a number`);
  }
}

function requireEnum(
  errors: string[],
  field: string,
  value: unknown,
  allowed: readonly string[],
): void {
  if (value == null) {
    errors.push(`${field} is required`);
  } else if (!allowed.includes(value as string)) {
    errors.push(`${field} must be one of ${allowed.join(', ')} (got ${String(value)})`);
  }
}

function checkGrade(errors: string[], field: string, value: number | null | undefined): void {
  if (value == null || typeof value !== 'number') return; // wrong types reported separately
  if (!Number.isInteger(value) || value < MIN_GRADE || value > MAX_GRADE) {
    errors.push(
      `${field}=${value} violates grade encoding (Pre-K ${MIN_GRADE}, K 0, 1..${MAX_GRADE})`,
    );
  }
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && !Number.isNaN(v);
}
