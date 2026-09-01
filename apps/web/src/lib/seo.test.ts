import { describe, expect, it } from 'vitest';
import { metaDescription } from '@/lib/seo';

// Meta descriptions are built from free-form curated text (the detail page's description),
// so the shaping has to survive whatever curators paste in: newlines, blank strings, and
// text far past the ~200-char SERP budget.
describe('metaDescription', () => {
  const fallback = 'Fallback: grades, deadlines, cost, and how to enter.';

  it('passes short text through, whitespace-collapsed', () => {
    expect(metaDescription('A  contest\nfor students.', fallback)).toBe('A contest for students.');
  });

  it('falls back on null, undefined, and blank strings alike', () => {
    expect(metaDescription(null, fallback)).toBe(fallback);
    expect(metaDescription(undefined, fallback)).toBe(fallback);
    // '' ?? fallback would NOT fall back — the old slice-based code shipped an empty description.
    expect(metaDescription('   ', fallback)).toBe(fallback);
  });

  it('trims long text at a word boundary with an ellipsis, under the 200-char budget', () => {
    const long = 'word '.repeat(60).trim(); // 299 chars of 4-letter words
    const out = metaDescription(long, fallback);
    expect(out.length).toBeLessThanOrEqual(201); // 200 + the ellipsis
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/wor…$/); // no mid-word cut
  });

  it('keeps an unbroken 200+ char token intact rather than deleting everything', () => {
    const token = 'x'.repeat(250);
    expect(metaDescription(token, fallback)).toBe(`${token.slice(0, 200)}…`);
  });
});
