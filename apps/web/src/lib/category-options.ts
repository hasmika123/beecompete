import type { SelectOption } from '@beecompete/ui';
import { CATEGORY_CONTENT } from '@/lib/category-content';

// Static category options for public forms. Kept static (no API call) so the consuming forms stay
// drop-in with no props.
//
// Was `digest-options.ts`: it also held the grade / interest / state lists for the Weekly Digest's
// preference questions, which were removed when the digest became one curated send for everyone
// (R1-15c, owner 2026-07-18). If M26 brings personalized digests back in Phase 2, those lists come
// back with it — see git history rather than re-deriving them.

// Request-a-Competition category picker: value = SLUG (posted as `categorySlug`), label = name.
export const CATEGORY_SLUG_OPTIONS: SelectOption[] = CATEGORY_CONTENT.filter(
  (c) => c.slug !== 'other',
).map((c) => ({ value: c.slug, label: c.name }));
