import type { SelectOption } from '@beecompete/ui';

// Feedback categories — shared by the form (labels) and the server action (allowlist). Kept out of
// actions.ts because a 'use server' module may only export async functions.
export const FEEDBACK_CATEGORIES: SelectOption[] = [
  { value: 'Bug', label: 'Something is broken (bug)' },
  { value: 'Idea / feature', label: 'An idea or feature request' },
  { value: 'Content issue', label: 'A listing looks wrong or missing' },
  { value: 'Other', label: 'Something else' },
];

const VALUES = FEEDBACK_CATEGORIES.map((c) => c.value);

/** Constrain a submitted category to the known set (defends the transactional email subject). */
export function normalizeFeedbackCategory(raw: string): string {
  return VALUES.includes(raw) ? raw : 'Other';
}
