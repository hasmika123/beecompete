import type { SelectOption } from '@beecompete/ui';

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
