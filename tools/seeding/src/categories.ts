/**
 * The 11 launch categories: slug -> category UUID and slug -> Category Template JSON Schema.
 *
 * These MUST stay in lock-step with apps/api's seed changeset
 * `0005-seed-categories.yaml` (fixed `beec0000-...` UUIDs, permissive draft-2020-12 schemas).
 * They are mirrored here so the pipeline can resolve `categoryId` and validate the extracted
 * `attributes` bag offline — the SAME schema the server re-checks via `CategoryAttributeValidator`
 * on approve. If a template is edited in the admin tool, refresh this file to match.
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
  student_status_required: { type: 'string' },
  syllabus: { type: 'string' },
  topics: arrayOfStrings,
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
