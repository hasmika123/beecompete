import { describe, expect, it } from 'vitest';
import { PASTE_JSON_STEP_SLICES } from '@/lib/paste-json-prompt.generated';
import { buildStepPrompt, stepSlice } from '@/lib/step-prompt';

const CONTEXT = {
  name: 'AMC 10',
  officialUrl: 'https://maa.org/amc',
  categoryName: 'Mathematics',
};

const PAYLOAD = { name: 'AMC 10', slug: 'amc-10', edition: { cycleLabel: '2026-27' } };

const prompt = (
  stepId: string,
  extra: Partial<typeof CONTEXT> & { attributesSchema?: Record<string, unknown> } = {},
) =>
  buildStepPrompt({
    slice: stepSlice(stepId)!,
    context: { ...CONTEXT, ...extra },
    payload: PAYLOAD,
  });

describe('step prompt slices', () => {
  /**
   * The eight ids are the contract with `stepDefs` in components/admin/competition-form.tsx: a
   * renamed step there would silently drop that tab's button, since StepPromptButton renders
   * nothing for an id it cannot find.
   */
  it('covers every step of the create form', () => {
    expect(PASTE_JSON_STEP_SLICES.map((s) => s.id)).toEqual([
      'overview',
      'administration',
      'eligibility',
      'judging',
      'awards',
      'timeline',
      'extras',
      'attributes',
    ]);
  });

  it('gives every step real shape lines', () => {
    for (const slice of PASTE_JSON_STEP_SLICES) {
      expect(slice.shape.trim(), `${slice.id} has no shape lines`).not.toBe('');
      expect(slice.shape, `${slice.id} shape is not JSON-shape lines`).toMatch(/^\s*"/);
    }
  });

  it('keeps multi-line keys whole', () => {
    // `resources` is an array of objects in the doc — the slicer has to carry its sample row and
    // its closing bracket, not just the opening line.
    const extras = stepSlice('extras')!;
    expect(extras.shape).toContain('"resources": [');
    expect(extras.shape).toContain('"isAffiliate"');
    expect(extras.shape).toContain('"faqs": [');
    expect(extras.shape).toContain('"answer"');
  });

  it('does not confuse a competition key with the one under the running', () => {
    // `currency` exists only under `edition` in the shape; `name` only at the top level.
    expect(stepSlice('administration')!.shape).toContain('"currency"');
    expect(stepSlice('overview')!.shape).toContain('"name"');
    expect(stepSlice('overview')!.shape).not.toContain('"registrationUrl"');
  });

  it('asks for the award rows in prose, since no payload key carries them', () => {
    expect(stepSlice('awards')!.tail).toContain('AFTER the JSON');
    expect(PASTE_JSON_STEP_SLICES.filter((s) => s.tail !== null)).toHaveLength(1);
  });
});

describe('buildStepPrompt', () => {
  it('names the step and the competition it is about', () => {
    const text = prompt('timeline');
    expect(text).toContain('"Timeline"');
    expect(text).toContain('Competition: AMC 10');
    expect(text).toContain('Official page: https://maa.org/amc');
    expect(text).toContain('Category: Mathematics');
  });

  it('says what is not known yet rather than sending a blank', () => {
    const text = prompt('overview', { name: '', officialUrl: '', categoryName: '' });
    expect(text).toContain('(not named yet');
    expect(text).toContain('(not filled in yet');
    expect(text).toContain('(not chosen yet)');
  });

  it('carries the listing as it stands, and asks for it back whole', () => {
    const text = prompt('judging');
    expect(text).toContain(JSON.stringify(PAYLOAD, null, 2));
    expect(text).toContain('Reply with this SAME object');
    // The round-trip depends on nothing else changing — pasting a fragment would blank the form.
    expect(text).toContain('Change nothing else');
  });

  it('quotes the doc rules for the steps that have them', () => {
    expect(prompt('timeline')).toContain('### DATE RULES — read these twice');
    expect(prompt('eligibility')).toContain('### GRADE ENCODING');
    // Judging's shape line says it all; there is no section to quote and none is invented.
    expect(prompt('judging')).not.toContain('###');
  });

  it('includes the category schema only for Custom fields', () => {
    const schema = { type: 'object', properties: { topics: { type: 'array' } } };
    const withSchema = prompt('attributes', { attributesSchema: schema });
    expect(withSchema).toContain('"topics"');
    // A null in the attributes bag is a save-blocker, so the prompt has to say so.
    expect(withSchema).toContain('Do not write null in this bag');
    expect(prompt('attributes')).not.toContain('JSON Schema');
  });

  it('always carries the no-guessing rule', () => {
    for (const slice of PASTE_JSON_STEP_SLICES) {
      expect(prompt(slice.id), `${slice.id} prompt`).toContain(
        'A fact the source does not state is null',
      );
    }
  });
});
