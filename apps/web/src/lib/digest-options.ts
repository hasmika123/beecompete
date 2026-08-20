import type { SelectOption } from '@beecompete/ui';
import { CATEGORY_CONTENT } from '@/lib/category-content';
import { US_STATES } from '@/lib/us-states';

// Static option lists for the weekly-digest preference questions (R1-15). Kept static (no API
// call) so the DigestBand stays a drop-in with no props on Landing / How It Works / Categories.
// Values are stored verbatim as Brevo contact attributes for segmentation — human-readable so the
// list is usable in Brevo without a lookup table.

// Grade encoding lives server-side (Pre-K −1 … 12); for the digest we only need a friendly label
// that a parent recognizes, so we store the label string.
export const GRADE_OPTIONS: SelectOption[] = [
  { value: 'Pre-K', label: 'Pre-K' },
  { value: 'Kindergarten', label: 'Kindergarten' },
  ...Array.from({ length: 12 }, (_, i) => {
    const g = i + 1;
    const suffix = g === 1 ? 'st' : g === 2 ? 'nd' : g === 3 ? 'rd' : 'th';
    return { value: `${g}${suffix} grade`, label: `${g}${suffix} grade` };
  }),
];

// Interests = the launch categories (minus the `other` fallback). Value = display name so the
// Brevo attribute reads cleanly.
export const INTEREST_OPTIONS: SelectOption[] = CATEGORY_CONTENT.filter(
  (c) => c.slug !== 'other',
).map((c) => ({ value: c.name, label: c.name }));

// Request-a-Competition category picker: value = SLUG (posted as `categorySlug`), label = name.
// Distinct from INTEREST_OPTIONS above, which intentionally uses names (stored as Brevo attributes).
export const CATEGORY_SLUG_OPTIONS: SelectOption[] = CATEGORY_CONTENT.filter(
  (c) => c.slug !== 'other',
).map((c) => ({ value: c.slug, label: c.name }));

// US states + DC. Value = full NAME (stored verbatim to Brevo — unchanged by #76). Derived from
// US_STATES so this picker and the card's abbreviated region label stay a single list.
export const STATE_OPTIONS: SelectOption[] = US_STATES.map((s) => ({
  value: s.name,
  label: s.name,
}));
