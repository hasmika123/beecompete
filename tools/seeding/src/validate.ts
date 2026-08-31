import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { CATEGORY_IDS, CATEGORY_TEMPLATES, type CategorySlug } from './categories.ts';
import type { TemplateMap } from './templates.ts';
import {
  COST_TYPES,
  DELIVERIES,
  EDITION_STATUSES,
  ELIGIBILITY_BASES,
  ENTRY_PATHWAYS,
  EVALUATION_TOKENS,
  KEY_DATE_TYPES,
  PARTICIPATION_MODES,
  RECURRENCES,
  RESOURCE_TYPES,
  SCOPE_LEVELS,
  type CompetitionPayload,
  type EditionPayload,
  type KeyDatePayload,
  type SeedPayload,
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

/**
 * The templates validation compiles against. Defaults to the checked-in mirror so every existing
 * caller (and every test) keeps working untouched; a real run calls `useTemplates()` first with
 * the SERVER's copy, so the offline check matches what the server will re-check on approve.
 * Module-level rather than a parameter because the compiled-validator cache is module-level too —
 * they have to be swapped together or the cache serves validators for the previous schema.
 */
let activeTemplates: TemplateMap = CATEGORY_TEMPLATES as TemplateMap;

/** Swap in this run's templates. Clears the compiled cache — stale validators outlive their schema. */
export function useTemplates(templates: TemplateMap): void {
  activeTemplates = templates;
  compiledTemplates.clear();
}

function templateValidator(slug: CategorySlug): ValidateFunction {
  let validate = compiledTemplates.get(slug);
  if (!validate) {
    validate = ajv.compile(activeTemplates[slug] ?? CATEGORY_TEMPLATES[slug]);
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
/** Server @Size caps on the edition + key-date fields (EditionRequest / FirstEditionKeyDate). */
const MAX_CYCLE_LABEL = 60;
const MAX_PRIZE_SUMMARY = 500;
const MAX_KEY_DATE_LABEL = 200;
const MAX_TIMEZONE = 60;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;
/** The card + search deadline reads REG_CLOSE, falling back to SUBMISSION_DUE (blueprint #31). */
const DEADLINE_TYPES = ['REG_CLOSE', 'SUBMISSION_DUE'];

/**
 * Validates a payload two ways:
 *   1. `attributes` against the correct Category Template JSON Schema (draft 2020-12) — the same
 *      schema apps/api re-checks on approve, so passing here means it won't bounce there.
 *   2. Spine sanity: required fields + TYPES (L3 — wrong-typed fields are errors, not crashes),
 *      enum tokens, grade encoding, age/team ranges, and http(s) URL fields ≤1000 chars (M2).
 *   3. The optional first `edition` + its `keyDates` (S3 v1), against the same rules the server
 *      applies to `EditionRequest`/`FirstEditionKeyDate` on approve.
 * This is a pre-flight gate; the SERVER remains the source of truth (Bean Validation on approve).
 */
export function validatePayload(payload: SeedPayload): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  validateSpine(payload, errors, warnings);
  errors.push(...validateAttributes(payload));
  validateEdition(payload, errors, warnings);
  return { ok: errors.length === 0, errors, warnings };
}

/**
 * The first edition + its timeline. Mirrors the server rules that DO apply to an import
 * (EditionRequest's own @NotNull/@Size/@Pattern/@AssertTrue set) — deliberately NOT the admin
 * form's completeness policy, which lives on CompetitionWithEditionRequest and would reject a
 * page that simply states no prize. Everything that policy would have caught is a WARNING here:
 * the curator decides, the pipeline doesn't block.
 */
function validateEdition(p: SeedPayload, errors: string[], warnings: string[]): void {
  const dates = p.keyDates;
  if (dates != null && !Array.isArray(dates)) {
    errors.push('keyDates must be an array');
    return;
  }
  if (p.edition == null) {
    // Same rule the approve path enforces: key dates hang off an edition, so dates without one
    // would be silently dropped server-side. Catch it here instead of at approve.
    if (dates && dates.length > 0) {
      errors.push('keyDates present without an edition — key dates belong to an edition');
    } else {
      warnings.push('no edition extracted — the listing stays hidden until a curator adds one');
    }
    return;
  }

  const e: EditionPayload = p.edition;
  if (typeof e.cycleLabel !== 'string' || e.cycleLabel.trim() === '') {
    errors.push('edition.cycleLabel is required');
  } else if (e.cycleLabel.length > MAX_CYCLE_LABEL) {
    errors.push(`edition.cycleLabel exceeds ${MAX_CYCLE_LABEL} chars`);
  }
  requireEnum(errors, 'edition.status', e.status, EDITION_STATUSES);
  requireEnum(errors, 'edition.scopeLevel', e.scopeLevel, SCOPE_LEVELS);
  if (e.registrationUrl != null) {
    checkHttpUrl(errors, 'edition.registrationUrl', e.registrationUrl);
  }
  checkNumberType(errors, 'edition.entryFee', e.entryFee);
  checkNumberType(errors, 'edition.prizeValue', e.prizeValue);
  if (isNum(e.entryFee) && e.entryFee < 0) errors.push('edition.entryFee must be >= 0');
  if (isNum(e.prizeValue) && e.prizeValue < 0) errors.push('edition.prizeValue must be >= 0');
  // Server @AssertTrue: a money amount without its currency is rejected on approve.
  if (isNum(e.entryFee) && !e.currency) errors.push('edition.entryFee needs edition.currency');
  if (isNum(e.prizeValue) && !e.prizeCurrency) {
    errors.push('edition.prizeValue needs edition.prizeCurrency');
  }
  checkCurrency(errors, 'edition.currency', e.currency);
  checkCurrency(errors, 'edition.prizeCurrency', e.prizeCurrency);
  if (typeof e.prizeSummary === 'string' && e.prizeSummary.length > MAX_PRIZE_SUMMARY) {
    errors.push(`edition.prizeSummary exceeds ${MAX_PRIZE_SUMMARY} chars`);
  }
  if (e.ageCutoffDate != null && !ISO_DATE.test(String(e.ageCutoffDate))) {
    errors.push('edition.ageCutoffDate must be an ISO date (yyyy-mm-dd)');
  }

  // Cost/fee coherence. The server can't catch this for imports (the rule lives on the admin
  // wrapper), and it is the kind of contradiction a curator must see rather than inherit.
  if (p.costType === 'FREE' && isNum(e.entryFee) && e.entryFee > 0) {
    warnings.push(`costType is FREE but edition.entryFee is ${e.entryFee}`);
  }
  if (p.costType === 'PAID' && !isNum(e.entryFee)) {
    warnings.push('costType is PAID but no entry fee was extracted');
  }

  validateKeyDates(dates ?? [], errors, warnings);
}

function validateKeyDates(dates: KeyDatePayload[], errors: string[], warnings: string[]): void {
  dates.forEach((d, i) => {
    const at = `keyDates[${i}]`;
    if (d == null || typeof d !== 'object') {
      errors.push(`${at} must be an object`);
      return;
    }
    requireEnum(errors, `${at}.type`, d.type, KEY_DATE_TYPES);
    if (typeof d.label === 'string' && d.label.length > MAX_KEY_DATE_LABEL) {
      errors.push(`${at}.label exceeds ${MAX_KEY_DATE_LABEL} chars`);
    }
    if (typeof d.timezone === 'string' && d.timezone.length > MAX_TIMEZONE) {
      errors.push(`${at}.timezone exceeds ${MAX_TIMEZONE} chars`);
    }
    // A ROUND_START or CUSTOM row carries no meaning without the page's own name for it (owner
    // 2026-08-30): unlabelled, the public timeline can only render the type — "Round begins" — which
    // says nothing about WHICH round. Unlike every other extraction gap this one is unrecoverable
    // without re-reading the source page, so it is surfaced at extraction time rather than left for
    // a later cleanup. A WARNING, not an error: the server accepts the row, and the curator can name
    // it during review.
    if (
      (d.type === 'ROUND_START' || d.type === 'CUSTOM' || d.type === 'PERIOD') &&
      (typeof d.label !== 'string' || d.label.trim() === '')
    ) {
      warnings.push(`${at} is ${d.type} with no label — name the round/key date as the page does`);
    }
    const start = checkInstant(errors, `${at}.startsAt`, d.startsAt);
    const end = checkInstant(errors, `${at}.endsAt`, d.endsAt);
    // Server @AssertTrue: an endsAt without a startsAt, or before it, is rejected.
    if (d.endsAt != null && d.startsAt == null) {
      errors.push(`${at}.endsAt requires a startsAt`);
    } else if (start != null && end != null && end <= start) {
      errors.push(`${at}.endsAt must be after startsAt`);
    }
  });

  const typed = dates.filter((d) => d && typeof d.type === 'string');
  /**
   * The registration pair is the ONLY singleton (owner 2026-08-31). Registration opens once and
   * closes once; a second of either is a different milestone wearing the wrong type.
   *
   * Not tidiness: `nextDeadline` is the earliest REG_CLOSE, so a second one silently becomes the
   * listing's deadline — an early-bird cutoff emitted as REG_CLOSE closes the listing weeks early.
   * The curation form flags this too, but only once a human is looking; this catches it at
   * extraction.
   *
   * ⚠ SUBMISSION_DUE and RESULTS are deliberately NOT here: they repeat per division or per round
   * ("junior entries due" / "senior entries due"; semifinal then final results). `nextDeadline`
   * copes — it takes the earliest FUTURE row, so several submission deadlines hand off to one
   * another as each passes. ROUND_START and the custom types are exempt for the same reason.
   */
  const SINGLETON_TYPES = ['REG_OPEN', 'REG_CLOSE'];
  for (const t of SINGLETON_TYPES) {
    const n = typed.filter((d) => d.type === t).length;
    if (n > 1) {
      warnings.push(
        `${n} ${t} rows — only one is meaningful; the extras belong on CUSTOM with a label` +
          (t === 'REG_CLOSE' ? ' (the EARLIEST becomes the listing deadline)' : ''),
      );
    }
  }
  if (!typed.some((d) => DEADLINE_TYPES.includes(d.type))) {
    // Not fatal — plenty of pages genuinely announce nothing yet — but the public card and
    // search read their deadline from these two types, so the listing will show none.
    warnings.push('no REG_CLOSE or SUBMISSION_DUE key date — the listing will show no deadline');
  }
  if (typed.length > 0 && typed.every((d) => d.startsAt == null)) {
    // Expected and CORRECT for a page that announces key dates without dates (TBD beats a
    // guess), but it is exactly the row a curator should chase, so surface it.
    warnings.push('every key date is TBD (no dates on the page) — curator lookup needed');
  }
}

/**
 * Returns the parsed epoch ms, or null when absent/invalid (the error is recorded).
 *
 * ⚠ A bare calendar date is REJECTED even though `Date.parse('2026-11-03')` succeeds in JS
 * (it reads as UTC midnight). The server maps startsAt/endsAt to `java.time.Instant`, whose
 * Jackson deserializer requires a time component and 422s on a date-only string. Accepting it
 * here would mean the pre-flight gate passes a payload approve then rejects — which is exactly
 * what this validator exists to prevent, and it happened for real on the first live submit.
 * (`edition.ageCutoffDate` is a LocalDate, so a bare date IS correct there — different check.)
 */
function checkInstant(
  errors: string[],
  field: string,
  value: string | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value !== 'string') {
    errors.push(`${field} must be an ISO-8601 string or null`);
    return null;
  }
  if (ISO_DATE.test(value)) {
    errors.push(
      `${field} is a date without a time (${value}); the server needs a full ISO-8601 ` +
        `instant, e.g. ${value}T00:00:00Z`,
    );
    return null;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    errors.push(`${field} is not a valid ISO-8601 instant (got ${value})`);
    return null;
  }
  return ms;
}

function checkCurrency(errors: string[], field: string, value: string | null | undefined): void {
  if (value == null) return;
  if (typeof value !== 'string' || !ISO_CURRENCY.test(value)) {
    errors.push(`${field} must be a 3-letter uppercase ISO code (got ${String(value)})`);
  }
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
  // A SET now (`0024`): required, non-empty, and every token known. The composites it replaced
  // (SCHOOL_OR_CHAPTER / EITHER) are rejected by the token check, which is the point — a payload
  // still emitting them was written against the old shape.
  if (!Array.isArray(p.entryPathways) || p.entryPathways.length === 0) {
    errors.push('entryPathways is required and must list at least one route');
  } else {
    const bad = p.entryPathways.filter((t) => !ENTRY_PATHWAYS.includes(t as never));
    if (bad.length) {
      errors.push(
        `unknown entryPathways token(s): ${bad.join(', ')} — allowed: ${ENTRY_PATHWAYS.join(', ')}`,
      );
    }
  }
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

  // Eligibility basis: which axis the page states. Absent is VALID and means "the page doesn't
  // say" — the one thing that is not allowed is an unrecognized token silently sailing through.
  if (p.eligibilityBasis != null && !ELIGIBILITY_BASES.includes(p.eligibilityBasis as never)) {
    errors.push(
      `unknown eligibilityBasis: ${String(p.eligibilityBasis)} — allowed: ${ELIGIBILITY_BASES.join(', ')}`,
    );
  }
  // The stated axis has to be backed by the range it claims, mirroring the server's @AssertTrue:
  // a payload claiming AGE with no age range publishes a rule it cannot show.
  const hasGrade = isNum(p.minGrade) || isNum(p.maxGrade);
  const hasAge = isNum(p.minAge) || isNum(p.maxAge);
  if (p.eligibilityBasis === 'GRADE' && !hasGrade) {
    errors.push('eligibilityBasis GRADE needs a grade range');
  }
  if (p.eligibilityBasis === 'AGE' && !hasAge) {
    errors.push('eligibilityBasis AGE needs an age range');
  }
  if (p.eligibilityBasis === 'BOTH' && !(hasGrade && hasAge)) {
    errors.push('eligibilityBasis BOTH needs both a grade range and an age range');
  }
  /**
   * The OTHER direction, which nothing else checks (owner 2026-08-31).
   *
   * The server's @AssertTrue only asks "does the claimed basis have its range?" — a payload with a
   * grade range and a NULL basis passes it, and passed straight through to a curation form where
   * "What does the organizer provide?" is required and unanswered. The paste prompt did not even
   * ask for the field, so every hand-pasted payload landed this way.
   *
   * A WARNING, not an error: null basis is a legitimate state on its own (the page said nothing),
   * and the pipeline's rule is that the curator decides. What is not legitimate is a range with no
   * basis — a range can only have come from a statement, and that statement had an axis.
   */
  if (p.eligibilityBasis == null && (hasGrade || hasAge)) {
    const axis = hasGrade && hasAge ? 'BOTH' : hasGrade ? 'GRADE' : 'AGE';
    warnings.push(
      `${hasGrade && hasAge ? 'grade and age ranges' : hasGrade ? 'a grade range' : 'an age range'}` +
        ` was extracted but eligibilityBasis is null — it is required on the form, and looks like ${axis}`,
    );
  }

  // Prep resources (2026-08-28). Absent is fine — plenty of competitions have little written
  // about them, and the prompt says so explicitly. What is NOT fine is a malformed row reaching a
  // curator's review screen looking like a real link.
  if (p.resources != null) {
    if (!Array.isArray(p.resources)) {
      errors.push('resources must be an array');
    } else {
      p.resources.forEach((r, i) => {
        const at = `resources[${i}]`;
        if (r === null || typeof r !== 'object' || Array.isArray(r)) {
          errors.push(`${at} must be an object`);
          return;
        }
        if (typeof r.title !== 'string' || r.title.trim() === '') {
          errors.push(`${at}.title is required`);
        }
        if (typeof r.url !== 'string' || !/^https?:\/\/\S+$/i.test(r.url.trim())) {
          errors.push(`${at}.url must be an absolute http(s) URL`);
        }
        if (!RESOURCE_TYPES.includes(r.type as never)) {
          errors.push(`${at}.type must be one of: ${RESOURCE_TYPES.join(', ')}`);
        }
        // A tagged link is a legal disclosure obligation (compliance DQ10). The extractor has no
        // business claiming one: tags are added by a curator, who ticks the box at the same time.
        if (r.isAffiliate === true) {
          errors.push(`${at}.isAffiliate must be false — affiliate tagging is a curator step`);
        }
      });
    }
  }

  // FAQ entries (2026-08-28). Absent is fine. A row missing either half is not: an unanswered
  // question would publish on the listing's FAQ tab, with FAQPage markup on it.
  if (p.faqs != null) {
    if (!Array.isArray(p.faqs)) {
      errors.push('faqs must be an array');
    } else {
      p.faqs.forEach((f, i) => {
        const at = `faqs[${i}]`;
        if (f === null || typeof f !== 'object' || Array.isArray(f)) {
          errors.push(`${at} must be an object`);
          return;
        }
        if (typeof f.question !== 'string' || f.question.trim() === '') {
          errors.push(`${at}.question is required`);
        } else if (f.question.length > 500) {
          errors.push(`${at}.question must be <= 500 characters`);
        }
        if (typeof f.answer !== 'string' || f.answer.trim() === '') {
          errors.push(`${at}.answer is required`);
        }
      });
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
