/**
 * Generates `src/lib/paste-json-prompt.generated.ts` from `docs/seeding/paste-json-prompt.md`,
 * so the admin "Fill the form from JSON" modal can hand a curator the current prompt without
 * anyone opening the repo.
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
 * One quoted source line per array entry, its line break carried INSIDE the string and the array
 * joined with '' — so a prompt edit diffs like the prose edit it is, and this script never has to
 * emit an escape sequence of its own.
 */
const quotedLines = (text) => {
  const rows = text.split(NEWLINE);
  return rows
    .map((l, i) => `  ${JSON.stringify(i === rows.length - 1 ? l : l + NEWLINE)},`)
    .join(NEWLINE);
};

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

/** The prompt a curator copies into an assistant — verbatim from the doc's copy box. */
export const PASTE_JSON_PROMPT = [
${quotedLines(prompt)}
].join('');
`;

fs.writeFileSync(out, file);
console.log(
  `paste-json-prompt.generated.ts: ${prompt.split(NEWLINE).length} prompt lines, ${steps().length} steps`,
);
