import type { SelectOption } from '@beecompete/ui';
import { defaultKeyDateLabel } from '@/lib/detail-display';

/** Title-case an enum token for display: SCHOOL_OR_CHAPTER → "School or chapter". */
/**
 * Tokens whose humanized spelling reads wrong in a dropdown (owner 2026-08-23): BOTH is
 * meaningless without its subject, and OPEN needs the "to all" to separate it from "open for
 * registration". Everything else derives from the token.
 */
const LABEL_OVERRIDES: Record<string, string> = {
  BOTH: 'Individual or team',
  OPEN: 'Open to all',
  SCHOOL: 'Through a school',
  CHAPTER: 'Through a chapter',
  SCHOOL_OR_CHAPTER: 'Through a school or chapter',
  ONE_OFF: 'One-time',
};

export function enumLabel(token: string): string {
  const override = LABEL_OVERRIDES[token];
  if (override) return override;
  const lower = token.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function enumOptions(tokens: readonly string[]): SelectOption[] {
  return tokens.map((t) => ({ value: t, label: enumLabel(t) }));
}

/**
 * Key-date key date options for the two curation editors (owner 2026-08-30).
 *
 * Labels come from `defaultKeyDateLabel` — the SAME map the public timeline renders — rather than
 * from the token, so the dropdown says exactly what a visitor will read: "Registration opens", not
 * the token-derived "Reg open". A curator picking a key date should be choosing the published
 * wording, not an abbreviation of the database token.
 *
 * CUSTOM is the one exception. Publicly it renders as "Event"; in the editor it is the escape
 * hatch for "none of these, I'll name it myself", so it keeps that word.
 */
export function keyDateOptions(tokens: readonly string[]): SelectOption[] {
  return tokens.map((t) => ({
    value: t,
    label:
      t === 'CUSTOM' ? 'Custom event' : t === 'PERIOD' ? 'Custom period' : defaultKeyDateLabel(t),
  }));
}
