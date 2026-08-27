import type { AwardJson } from '@/lib/competition-payload';

/**
 * The worked example the awards editor SUGGESTS in its first row (owner 2026-08-25) — grey
 * placeholder text, not a filled-in value. It shows the shape of a finished award without putting
 * anything in the payload: an untouched Awards tab saves no awards and leaves the completion ring
 * honestly incomplete.
 *
 * History worth keeping, because this flipped twice: the values were briefly REAL (pre-filled), so
 * that the card preview beside them had something to render. That made the preview agree with the
 * fields but meant a curator who skipped the tab shipped a fake "$10,000 first place". The
 * settled answer keeps the placeholders grey AND feeds {@link EXAMPLE_AWARD_JSON} to the preview
 * while the editor is empty — so the preview demonstrates the same example the placeholders
 * suggest, and renders muted to say it is a demonstration rather than a saved value.
 *
 * One constant drives both, so the "$10,000" in the preview can never drift from the "10000" in
 * the placeholder beside it.
 */
export const EXAMPLE_AWARD_ROW = {
  title: 'First place — national finals',
  type: 'monetary',
  value: '10000',
  currency: 'USD',
  detail: '',
} as const;

/** The same example in payload shape — what the preview renders from while the editor is empty. */
export const EXAMPLE_AWARD_JSON: AwardJson = {
  title: EXAMPLE_AWARD_ROW.title,
  type: EXAMPLE_AWARD_ROW.type,
  value: Number(EXAMPLE_AWARD_ROW.value),
  currency: EXAMPLE_AWARD_ROW.currency,
};
