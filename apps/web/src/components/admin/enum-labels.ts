import type { SelectOption } from '@beecompete/ui';

/** Title-case an enum token for display: SCHOOL_OR_CHAPTER → "School or chapter". */
export function enumLabel(token: string): string {
  const lower = token.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function enumOptions(tokens: readonly string[]): SelectOption[] {
  return tokens.map((t) => ({ value: t, label: enumLabel(t) }));
}
