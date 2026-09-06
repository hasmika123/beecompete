import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PASTE_JSON_PROMPT,
  PASTE_JSON_PROMPT_SOURCE,
  PASTE_JSON_PROMPT_STEPS,
} from '@/lib/paste-json-prompt.generated';

/**
 * The admin paste-JSON modal ships a COPY of the prompt doc (generated into the bundle, because
 * the Docker build context excludes docs/ — see scripts/generate-paste-json-prompt.mjs). This is
 * what keeps the copy honest: edit the doc without regenerating and CI fails here, naming the
 * command to run. Without it a curator could copy a prompt the repo stopped using months ago.
 */
const doc = readFileSync(
  fileURLToPath(new URL(`../../../../${PASTE_JSON_PROMPT_SOURCE}`, import.meta.url)),
  'utf8',
)
  .split(String.fromCharCode(13))
  .join('');

const REGENERATE = 'run `pnpm --filter @beecompete/web gen:prompt` and commit the result';

describe('paste JSON prompt', () => {
  it('is the doc\u2019s copy box, verbatim', () => {
    const fence = doc.match(/^````text\n([\s\S]*?)\n````$/m);
    expect(fence, `${PASTE_JSON_PROMPT_SOURCE} has no four-backtick text block`).not.toBeNull();
    expect(PASTE_JSON_PROMPT, `prompt has drifted from the doc \u2014 ${REGENERATE}`).toBe(
      fence![1],
    );
  });

  it('carries the doc\u2019s numbered instructions', () => {
    const numbered = doc
      .match(/^## Instructions\n([\s\S]*?)^## /m)![1]!
      .split(String.fromCharCode(10))
      .filter((l) => /^\d+\.\s/.test(l));
    expect(PASTE_JSON_PROMPT_STEPS.length, `steps have drifted \u2014 ${REGENERATE}`).toBe(
      numbered.length,
    );
    // First words only: the generated step drops **bold**/`code` markers, so a full-text compare
    // would be re-implementing the generator rather than checking it.
    expect(PASTE_JSON_PROMPT_STEPS[0]).toBe(numbered[0]!.replace(/^\d+\.\s+/, '').trim());
  });

  it('ends with the placeholder the curator replaces', () => {
    expect(PASTE_JSON_PROMPT.trimEnd().endsWith('>>>')).toBe(true);
    expect(PASTE_JSON_PROMPT).toContain('[PASTE THE URL, PAGE TEXT, OR YOUR NOTES HERE]');
  });
});
