/**
 * The 11 launch categories: slug -> category UUID and slug -> Category Template JSON Schema.
 *
 * These MUST stay in lock-step with apps/api's template changesets — `0005-seed-categories.yaml`
 * (fixed `beec0000-...` UUIDs, permissive draft-2020-12 schemas) AND every later changeset that
 * edits a template: `0015` judging keys, `0017` the eligibility catch-all, `0019` contact keys,
 * `0022` student_status_required -> boolean.
 * They are mirrored here so the pipeline can resolve `categoryId` and validate the extracted
 * `attributes` bag offline — the SAME schema the server re-checks via `CategoryAttributeValidator`
 * on approve. If a template is edited in the admin tool, refresh this file to match.
 *
 * ⚠ This file is ALSO what the extraction prompt is generated from (see prompt.ts —
 * `renderAttributeGuidance`). Drift here is not just a weaker offline check: it silently stops the
 * model being told a key exists, so the field is never extracted at all. Templates carry
 * `additionalProperties: true`, so nothing fails loudly — the data just never arrives.
 * That is exactly how 0015/0017/0019's six keys went unextracted until 2026-08-26.
 */

export type CategorySlug =
  | 'math'
  | 'science-engineering'
  | 'computer-science'
  | 'robotics'
  | 'debate-speech'
  | 'business-entrepreneurship'
  | 'writing-essay'
  | 'arts-music'
  | 'academic-bowl'
  | 'history-geography-civics'
  | 'other';

export const CATEGORY_IDS: Record<CategorySlug, string> = {
  math: 'beec0000-0000-4000-8000-000000000001',
  'science-engineering': 'beec0000-0000-4000-8000-000000000002',
  'computer-science': 'beec0000-0000-4000-8000-000000000003',
  robotics: 'beec0000-0000-4000-8000-000000000004',
  'debate-speech': 'beec0000-0000-4000-8000-000000000005',
  'business-entrepreneurship': 'beec0000-0000-4000-8000-000000000006',
  'writing-essay': 'beec0000-0000-4000-8000-000000000007',
  'arts-music': 'beec0000-0000-4000-8000-000000000008',
  'academic-bowl': 'beec0000-0000-4000-8000-000000000009',
  'history-geography-civics': 'beec0000-0000-4000-8000-00000000000a',
  other: 'beec0000-0000-4000-8000-00000000000b',
};

export const CATEGORY_SLUGS = Object.keys(CATEGORY_IDS) as CategorySlug[];

type JsonSchema = Record<string, unknown>;

const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
const arrayOfStrings = { type: 'array', items: { type: 'string' } } as const;

/** Keys every category template shares (domain-model §3a standard attributes-bag keys). */
const baseProps: Record<string, JsonSchema> = {
  eligible_countries: arrayOfStrings,
  citizenship_countries: arrayOfStrings,
  // Boolean since API changelog `0022` (owner 2026-08-26): "is being a student required?", not
  // a sentence about which students. Prose belongs in other_eligibility_requirements.
  student_status_required: { type: 'boolean' },
  // The eligibility catch-all (`0017`) — the prose home for rules the typed keys can't express.
  other_eligibility_requirements: { type: 'string' },
  syllabus: { type: 'string' },
  topics: arrayOfStrings,
  // Judging catalog-info (`0015`). ⚠ judging_criteria is an ARRAY; tie_breakers is prose.
  judging_criteria: arrayOfStrings,
  tie_breakers: { type: 'string' },
  rules_url: { type: 'string', format: 'uri' },
  // Contact pair (`0019`), rendered on the public Logistics tab.
  contact_email: { type: 'string', format: 'email' },
  contact_phone: { type: 'string' },
};

function template(extra: Record<string, JsonSchema>): JsonSchema {
  return {
    $schema: DRAFT,
    type: 'object',
    additionalProperties: true,
    properties: { ...baseProps, ...extra },
  };
}

export const CATEGORY_TEMPLATES: Record<CategorySlug, JsonSchema> = {
  math: template({
    calculator_allowed: { type: 'boolean' },
    proof_based: { type: 'boolean' },
  }),
  'science-engineering': template({
    isef_affiliated: { type: 'boolean' },
    fair_levels: arrayOfStrings,
    project_categories: arrayOfStrings,
  }),
  'computer-science': template({
    languages: arrayOfStrings,
    submission_platform: { type: 'string' },
  }),
  robotics: template({
    league: { type: 'string' },
    kit_platform: { type: 'string' },
    game_title: { type: 'string' },
  }),
  'debate-speech': template({
    debate_formats: arrayOfStrings,
    speech_events: arrayOfStrings,
  }),
  'business-entrepreneurship': template({
    ctso: { type: 'string' },
    event_categories: arrayOfStrings,
  }),
  'writing-essay': template({
    genres: arrayOfStrings,
    word_limit: { type: 'integer' },
  }),
  'arts-music': template({
    disciplines: arrayOfStrings,
    media_types: arrayOfStrings,
  }),
  'academic-bowl': template({
    quiz_format: { type: 'string' },
    subjects_covered: arrayOfStrings,
  }),
  'history-geography-civics': template({
    focus_areas: arrayOfStrings,
  }),
  other: template({}),
};

export function isCategorySlug(value: string): value is CategorySlug {
  return value in CATEGORY_IDS;
}
