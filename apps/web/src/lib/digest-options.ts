import type { SelectOption } from '@beecompete/ui';
import { CATEGORY_CONTENT } from '@/lib/category-content';

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

// US states + DC. Value = full name (stored to Brevo); the Select is searchable at this length.
export const STATE_OPTIONS: SelectOption[] = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'District of Columbia',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
].map((s) => ({ value: s, label: s }));
