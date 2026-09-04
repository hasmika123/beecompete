import { describe, expect, it } from 'vitest';
import type { DuplicateCandidate } from '@/lib/admin-types';
import {
  blocksBulkApprove,
  describeReasons,
  hardCompetitionMatch,
  isLiveNameMatch,
  queueDuplicateBadge,
} from '@/lib/duplicates';

function candidate(overrides: Partial<DuplicateCandidate>): DuplicateCandidate {
  return {
    id: 'c1',
    slug: 'mathcounts',
    name: 'MATHCOUNTS',
    organizerName: 'MATHCOUNTS Foundation',
    listingStatus: 'PUBLISHED',
    archivedAt: null,
    reasons: [],
    ...overrides,
  };
}

describe('isLiveNameMatch — the one verdict no checkbox overrides', () => {
  it('is a live listing with the same name key', () => {
    expect(isLiveNameMatch(candidate({ reasons: ['NAME_EXACT'] }))).toBe(true);
  });
  it('is NOT an archived same-name listing, nor a URL/similar match', () => {
    expect(isLiveNameMatch(candidate({ reasons: ['NAME_EXACT'], archivedAt: '2026-01-01' }))).toBe(
      false,
    );
    expect(isLiveNameMatch(candidate({ reasons: ['URL_EXACT', 'NAME_SIMILAR'] }))).toBe(false);
    expect(isLiveNameMatch(null)).toBe(false);
  });
  it('hardCompetitionMatch finds it anywhere in the list', () => {
    const soft = candidate({ id: 'soft', reasons: ['URL_EXACT'] });
    const hard = candidate({ id: 'hard', reasons: ['NAME_EXACT'] });
    expect(hardCompetitionMatch({ catalog: [soft, hard], pending: [] })?.id).toBe('hard');
    expect(hardCompetitionMatch({ catalog: [soft], pending: [] })).toBeNull();
    expect(hardCompetitionMatch(null)).toBeNull();
  });
});

describe('queueDuplicateBadge — the row flag, strongest reason first', () => {
  it('reads red for what fails outright and gold for what the form can confirm through', () => {
    expect(
      queueDuplicateBadge({ duplicate: candidate({ reasons: ['NAME_EXACT', 'URL_EXACT'] }) }),
    ).toEqual({ label: 'already listed', variant: 'danger' });
    expect(queueDuplicateBadge({ duplicate: candidate({ reasons: ['SLUG_TAKEN'] }) })).toEqual({
      label: 'slug taken',
      variant: 'danger',
    });
    expect(
      queueDuplicateBadge({
        duplicate: candidate({ reasons: ['NAME_EXACT'], archivedAt: '2026-01-01' }),
      }),
    ).toEqual({ label: 'listed before (archived)', variant: 'gold' });
    expect(queueDuplicateBadge({ duplicate: candidate({ reasons: ['URL_EXACT'] }) })).toEqual({
      label: 'same URL as a listing',
      variant: 'gold',
    });
    expect(queueDuplicateBadge({ duplicate: null })).toBeNull();
  });
});

describe('blocksBulkApprove', () => {
  it('any catalog match at all — bulk cannot carry the confirmation only the form can give', () => {
    expect(blocksBulkApprove({ duplicate: candidate({ reasons: ['NAME_SIMILAR'] }) })).toBe(true);
    expect(blocksBulkApprove({ duplicate: null })).toBe(false);
  });
});

describe('describeReasons', () => {
  it('joins the human labels', () => {
    expect(describeReasons(['NAME_EXACT', 'URL_EXACT'])).toBe('same name · same official URL');
  });
});
