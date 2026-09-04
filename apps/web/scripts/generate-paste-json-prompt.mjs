/**
 * Generates `src/lib/paste-json-prompt.generated.ts` from `docs/seeding/paste-json-prompt.md`:
 * the whole prompt for the admin "Fill the form from JSON" modal, plus a per-STEP cut of it for
 * the mini prompts on each tab of the create form.
 *
 * WHY A GENERATED FILE and not a read of the markdown at runtime: `.dockerignore` excludes
 * `docs` and every `*.md` from the image build context, and the standalone runtime stage carries
 * only Next's output — so the file simply does not exist in production. Baking it into the bundle
 * at source level is the one shape that works in dev, in test, and in the container.
 *
 * The generated file IS COMMITTED (the Docker build cannot regenerate it — see above), and CI
 * re-runs this script and fails on a diff, so editing the prompt doc without refreshing the app
 * copy cannot merge. `pnpm dev` and `pnpm build` regenerate it for you.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NEWLINE = String.fromCharCode(10);
const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_REL = 'docs/seeding/paste-json-prompt.md';
const source = path.join(here, '..', '..', '..', SOURCE_REL);
const out = path.join(here, '..', 'src', 'lib', 'paste-json-prompt.generated.ts');

/**
 * The image build has no docs/ (`.dockerignore` drops it), and that is expected, not a failure:
 * the committed generated file is what ships. Anywhere with a real checkout, the file is here and
 * gets rebuilt — and the drift test in src/lib/paste-json-prompt.test.ts is what makes sure the
 * committed copy was current when it was committed.
 */
if (!fs.existsSync(source)) {
  console.log(`${SOURCE_REL} not in this build context — keeping the committed paste-JSON prompt.`);
  process.exit(0);
}

const md = fs.readFileSync(source, 'utf8').split(String.fromCharCode(13)).join('');

/**
 * The prompt itself — the one ````text fence (four backticks, because the prompt body contains
 * ``` fences of its own). Anchored on the fence rather than on the headings around it, so
 * re-organising the prose changes nothing here.
 */
const fence = md.match(/^````text\n([\s\S]*?)\n````$/m);
if (!fence)
  throw new Error(`${SOURCE_REL}: no four-backtick "text" block — that box is what gets copied.`);
const prompt = fence[1];

/** `**bold**` and `` `code` `` markers, dropped for plain-text rendering. */
const plain = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');

/** The numbered list under "## Instructions" — the workflow around the paste, in the doc's words. */
function steps() {
  const section = md.match(/^## Instructions\n([\s\S]*?)^## /m);
  if (!section) throw new Error(`${SOURCE_REL}: no "## Instructions" section found.`);
  const items = [];
  for (const line of section[1].split(NEWLINE)) {
    if (/^\d+\.\s/.test(line)) items.push(line.replace(/^\d+\.\s+/, '').trim());
    else if (items.length > 0 && /^\s+\S/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
    else if (line.trim() !== '' && items.length > 0) break;
  }
  if (items.length === 0) throw new Error(`${SOURCE_REL}: the Instructions list is empty.`);
  return items.map(plain);
}

/**
 * THE STEP MANIFEST — which part of the prompt answers which tab of the create form.
 *
 * Each entry names the payload keys that tab owns (`edition.`-prefixed for the ones under the
 * running) and the `###` sections whose rules govern them. The slicers below cut exactly those
 * lines out of the doc, so the wording keeps ONE home: change a rule in the prompt and every mini
 * prompt quoting it changes with it.
 *
 * `tail` is for what the JSON cannot carry back. The award ROWS have no payload key (see
 * MAPPED_COMPETITION_KEYS in lib/import-seed.ts), so that tab asks for them in prose and the
 * curator types them in — better than a button that produces something unpasteable.
 *
 * The ids match `stepDefs` in components/admin/competition-form.tsx. A key or heading that stops
 * existing throws here rather than quietly emitting an empty prompt.
 */
const STEPS = [
  {
    id: 'overview',
    label: 'Overview',
    keys: ['slug', 'name', 'categorySlug', 'organizerName', 'officialUrl', 'description', 'tags'],
    sections: ['categorySlug — pick exactly one'],
  },
  {
    id: 'administration',
    label: 'Administration',
    keys: [
      'participationMode',
      'teamSizeMin',
      'teamSizeMax',
      'delivery',
      'entryPathways',
      'costType',
      'recurrence',
      'edition.registrationUrl',
      'edition.entryFee',
      'edition.currency',
    ],
    sections: ['REGISTRATION URL — never leave it empty'],
  },
  {
    id: 'eligibility',
    label: 'Eligibility',
    keys: ['eligibilityBasis', 'minGrade', 'maxGrade', 'minAge', 'maxAge', 'edition.ageCutoffDate'],
    sections: ['ELIGIBILITY BASIS — set this whenever you set a grade or an age', 'GRADE ENCODING'],
  },
  { id: 'judging', label: 'Judging', keys: ['evaluationType'], sections: [] },
  {
    id: 'awards',
    label: 'Awards',
    keys: ['edition.prizeSummary', 'edition.prizeValue', 'edition.prizeCurrency'],
    sections: [],
    tail:
      'AFTER the JSON, list every award the source actually names — the award title, then its cash ' +
      'value or what it is (a medal, a trip, a scholarship) — one per line, in the order the source ' +
      'presents them. That list has no key in the payload, so I type those rows in myself. Only ' +
      'awards the source states; no filling out a ladder that is not there.',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    keys: ['edition.cycleLabel', 'edition.status', 'edition.scopeLevel', 'keyDates'],
    sections: [
      'EDITION STATUS — where this running is in its cycle',
      'DATE RULES — read these twice',
    ],
  },
  {
    id: 'extras',
    label: 'Resources & FAQ',
    keys: ['resources', 'faqs'],
    sections: [
      'resources — how someone actually prepares',
      'faqs — the questions a parent actually asks',
    ],
  },
  {
    id: 'attributes',
    label: 'Custom fields',
    keys: ['attributes'],
    sections: ['attributes — the facts keyed by our Category Template'],
  },
];

const promptLines = prompt.split(NEWLINE);
const indentOf = (line) => line.length - line.trimStart().length;

/** The "## The JSON shape" listing, as line indices into the prompt. */
const shapeBlock = (() => {
  const start = promptLines.findIndex((l) => l.trim() === '## The JSON shape');
  if (start < 0) throw new Error(`${SOURCE_REL}: no "## The JSON shape" heading.`);
  let end = promptLines.length;
  for (let i = start + 1; i < promptLines.length; i += 1) {
    if (/^#{2,3} /.test(promptLines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
})();

/**
 * The lines describing ONE key: its own line, plus everything nested or commented under it, up to
 * the next key (or closing bracket) at the same depth or shallower. That one rule is what lets a
 * one-liner like `slug` and a multi-line array like `resources` both come out whole, comments
 * included, without the manifest having to know which is which.
 *
 * Depth also disambiguates: a competition key sits at indent 2, a key under the running at 4, and
 * the sample rows inside `resources` / `keyDates` deeper still — so `currency` cannot be confused
 * with `edition.currency`.
 */
function keyLines(spec) {
  const [scope, key] = spec.includes('.') ? spec.split('.') : ['competition', spec];
  const indent = scope === 'edition' ? 4 : 2;
  const head = new RegExp(`^ {${indent}}"${key}":`);
  let start = -1;
  for (let i = shapeBlock.start; i < shapeBlock.end; i += 1) {
    if (head.test(promptLines[i])) {
      if (start >= 0) throw new Error(`${SOURCE_REL}: "${spec}" appears twice in the JSON shape.`);
      start = i;
    }
  }
  if (start < 0) throw new Error(`${SOURCE_REL}: the JSON shape has no "${spec}" key.`);

  const out = [promptLines[start]];
  for (let i = start + 1; i < shapeBlock.end; i += 1) {
    const line = promptLines[i];
    if (line.trim() === '') break;
    const depth = indentOf(line);
    const isKey = /^\s*"[A-Za-z_]+":/.test(line);
    const isClose = /^\s*[}\]]/.test(line);
    if (depth <= indent && (isKey || isClose)) {
      // A bracket closing THIS key's own block belongs to it; anything else starts the next key.
      if (isClose && depth === indent) out.push(line);
      break;
    }
    out.push(line);
  }
  return out.join(NEWLINE);
}

/** One `###` section of the prompt, heading included, up to the next heading. */
function section(title) {
  const start = promptLines.findIndex((l) => l.trim() === `### ${title}`);
  if (start < 0) throw new Error(`${SOURCE_REL}: no "### ${title}" section.`);
  let end = promptLines.length;
  for (let i = start + 1; i < promptLines.length; i += 1) {
    if (/^#{2,3} /.test(promptLines[i])) {
      end = i;
      break;
    }
  }
  return promptLines.slice(start, end).join(NEWLINE).replace(/\s+$/, '');
}

const slices = STEPS.map((step) => ({
  id: step.id,
  label: step.label,
  shape: step.keys.map(keyLines).join(NEWLINE),
  rules: step.sections.map(section).join(NEWLINE + NEWLINE),
  tail: step.tail ?? null,
}));

/**
 * One quoted source line per array entry, its line break carried INSIDE the string and the array
 * joined with '' — so a prompt edit diffs like the prose edit it is, and this script never has to
 * emit an escape sequence of its own.
 */
const quotedLines = (text, pad = '') => {
  const rows = text.split(NEWLINE);
  return rows
    .map((l, i) => `${pad}  ${JSON.stringify(i === rows.length - 1 ? l : l + NEWLINE)},`)
    .join(NEWLINE);
};

/** One entry of PASTE_JSON_STEP_SLICES, indented to sit inside the array literal. */
const sliceLiteral = (s) =>
  [
    '  {',
    `    id: ${JSON.stringify(s.id)},`,
    `    label: ${JSON.stringify(s.label)},`,
    '    shape: [',
    quotedLines(s.shape, '    '),
    "    ].join(''),",
    '    rules: [',
    quotedLines(s.rules, '    '),
    "    ].join(''),",
    `    tail: ${JSON.stringify(s.tail)},`,
    '  },',
  ].join(NEWLINE);

const file = `// GENERATED FILE — DO NOT EDIT.
//
// Source: ${SOURCE_REL} (edit the prompt THERE).
// Regenerate: pnpm --filter @beecompete/web gen:prompt — \`pnpm dev\` and \`pnpm build\` do it for
// you, and CI fails if this file has drifted from the doc.
//
// It exists so the admin paste-JSON modal can offer the current prompt: the markdown itself is
// excluded from the Docker build context, so the app can only ship it as code.

/** Where the prompt is maintained — shown in the UI so the source of truth stays findable. */
export const PASTE_JSON_PROMPT_SOURCE = '${SOURCE_REL}';

/** The numbered workflow from the doc's "Instructions" section. */
export const PASTE_JSON_PROMPT_STEPS: readonly string[] = [
${steps()
  .map((s) => `  ${JSON.stringify(s)},`)
  .join(NEWLINE)}
];

/**
 * A per-STEP cut of the same prompt — the shape lines and rules for ONE tab of the create form,
 * so a curator can ask an assistant for just the fields in front of them. Sliced by the manifest
 * in the generator; composed into a prompt by lib/step-prompt.ts.
 */
export interface StepPromptSlice {
  /** Matches a step id in components/admin/competition-form.tsx. */
  id: string;
  label: string;
  /** The JSON-shape lines for this step's keys, comments and all. */
  shape: string;
  /** The prompt's own \`###\` sections governing them; empty when the shape lines say it all. */
  rules: string;
  /** What to ask for in prose because no payload key can carry it back (the award rows). */
  tail: string | null;
}

export const PASTE_JSON_STEP_SLICES: readonly StepPromptSlice[] = [
${slices.map(sliceLiteral).join(NEWLINE)}
];

/** The prompt a curator copies into an assistant — verbatim from the doc's copy box. */
export const PASTE_JSON_PROMPT = [
${quotedLines(prompt)}
].join('');
`;

fs.writeFileSync(out, file);
console.log(
  `paste-json-prompt.generated.ts: ${prompt.split(NEWLINE).length} prompt lines, ` +
    `${steps().length} instructions, ${slices.length} step slices`,
);
