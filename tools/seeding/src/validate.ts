import Ajv2020 from 'ajv/dist/2020.js';
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
}

const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));

const idToSlug = new Map<string, CategorySlug>(
  (Object.entries(CATEGORY_IDS) as [CategorySlug, string][]).map(([slug, id]) => [id, slug]),
);

const MIN_GRADE = -1; // Pre-K
const MAX_GRADE = 12;

/**
 * Validates a payload two ways:
 *   1. `attributes` against the correct Category Template JSON Schema (draft 2020-12) — the same
 *      schema apps/api re-checks on approve, so passing here means it won't bounce there.
 *   2. Basic Spine sanity: required fields, enum tokens, grade encoding, age/team ranges.
 * This is a pre-flight gate; the SERVER remains the source of truth (Bean Validation on approve).
 */
export function validatePayload(payload: CompetitionPayload): ValidationResult {
  const errors: string[] = [...validateSpine(payload), ...validateAttributes(payload)];
  return { ok: errors.length === 0, errors };
}

function validateSpine(p: CompetitionPayload): string[] {
  const errors: string[] = [];

  if (!p.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) {
    errors.push('slug must be non-empty lowercase kebab-case');
  }
  if (p.slug && p.slug.length > 160) errors.push('slug exceeds 160 chars');
  if (!p.name?.trim()) errors.push('name is required');
  if (p.name && p.name.length > 300) errors.push('name exceeds 300 chars');
  if (p.summary && p.summary.length > 300) errors.push('summary exceeds 300 chars');

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

  checkGrade(errors, 'minGrade', p.minGrade);
  checkGrade(errors, 'maxGrade', p.maxGrade);
  if (isNum(p.minGrade) && isNum(p.maxGrade) && p.minGrade > p.maxGrade) {
    errors.push(`minGrade (${p.minGrade}) must be <= maxGrade (${p.maxGrade})`);
  }
  if (isNum(p.minAge) && isNum(p.maxAge) && p.minAge > p.maxAge) {
    errors.push(`minAge (${p.minAge}) must be <= maxAge (${p.maxAge})`);
  }
  if (isNum(p.minAge) && p.minAge < 0) errors.push('minAge must be >= 0');
  if (isNum(p.teamSizeMin) && isNum(p.teamSizeMax) && p.teamSizeMin > p.teamSizeMax) {
    errors.push(`teamSizeMin (${p.teamSizeMin}) must be <= teamSizeMax (${p.teamSizeMax})`);
  }

  return errors;
}

function validateAttributes(p: CompetitionPayload): string[] {
  if (p.attributes == null) return [];
  const slug = p.categoryId ? idToSlug.get(p.categoryId) : undefined;
  if (!slug) return []; // categoryId error already reported by the spine check
  const schema = CATEGORY_TEMPLATES[slug];
  const validate = ajv.compile(schema);
  if (validate(p.attributes)) return [];
  return (validate.errors ?? []).map(
    (e) => `attributes${e.instancePath || ''} ${e.message ?? 'is invalid'}`,
  );
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
  if (value == null) return;
  if (!Number.isInteger(value) || value < MIN_GRADE || value > MAX_GRADE) {
    errors.push(
      `${field}=${value} violates grade encoding (Pre-K ${MIN_GRADE}, K 0, 1..${MAX_GRADE})`,
    );
  }
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && !Number.isNaN(v);
}
