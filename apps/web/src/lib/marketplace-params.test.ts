import { describe, expect, it } from 'vitest';
import { activeChips, type MarketplaceParams } from '@/lib/marketplace-params';

const params = (over: Partial<MarketplaceParams> = {}): MarketplaceParams => ({ page: 0, ...over });
const keys = (chips: ReturnType<typeof activeChips>) => chips.map((c) => c.key);

// A10: a grade range that exactly matches a quick-chip band is represented ONLY by the
// highlighted quick-chip, never a removable tag; custom ranges still get a tag. Value-canonical
// (depends only on the URL), so shared links render identically.
describe('activeChips — grade band suppression', () => {
  it('suppresses the grade chip for a band-exact range (Elementary −1..5)', () => {
    const chips = activeChips('/competitions', params({ minGrade: -1, maxGrade: 5 }));
    expect(keys(chips)).not.toContain('grade');
  });

  it('suppresses the grade chip for High School (9..12)', () => {
    const chips = activeChips('/competitions', params({ minGrade: 9, maxGrade: 12 }));
    expect(keys(chips)).not.toContain('grade');
  });

  it('keeps a grade tag for a custom range (3..7)', () => {
    const chips = activeChips('/competitions', params({ minGrade: 3, maxGrade: 7 }));
    const grade = chips.find((c) => c.key === 'grade');
    expect(grade?.label).toBe('Grades 3–7');
  });

  it('emits no grade chip when no grade filter is set', () => {
    expect(keys(activeChips('/competitions', params()))).not.toContain('grade');
  });

  it('emits a category chip using the provided name', () => {
    const chips = activeChips('/competitions', params({ category: 'math' }), undefined, 'Math');
    expect(chips.find((c) => c.key === 'category')?.label).toBe('Math');
  });
});
