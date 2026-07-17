'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/admin-api';
import { HERO_POSITIONS, LANDING_SLOTS, type FormState } from '@/lib/admin-types';

/** Human label per position, for error messages. */
const POSITION_LABEL: Record<string, string> = {
  MAIN: 'Main card',
  TOP_RIGHT: 'Top-right satellite',
  BOTTOM_LEFT: 'Bottom-left satellite',
};

const str = (form: FormData, key: string) => ((form.get(key) as string) ?? '').trim();

/**
 * Landing content is admin-managed but the public landing (`/`) caches its fetch for an hour
 * (CATALOG_REVALIDATE). Revalidate BOTH paths on every save so an edit shows on the live page
 * right away, not up to an hour later — and refresh the admin view too.
 */
function revalidateLanding() {
  revalidatePath('/admin/landing');
  revalidatePath('/');
}

/**
 * Save all three hero cards in one submit (M36). Fields are namespaced per position
 * (`MAIN_imageKey`, `TOP_RIGHT_altText`, …). A position with no image is skipped — the satellites
 * are optional (the public hero shows a gradient placeholder), so an admin can set just the main
 * card. A card WITH an image must have alt text (accessibility + the server's `@NotBlank`). Each
 * position upserts through the existing per-position `PUT /hero-cards/{position}`.
 */
export async function saveHeroCards(_prev: FormState, form: FormData): Promise<FormState> {
  const errors: string[] = [];
  let saved = 0;

  for (const position of HERO_POSITIONS) {
    const imageKey = str(form, `${position}_imageKey`);
    if (!imageKey) continue; // untouched / cleared → leave as-is

    const altText = str(form, `${position}_altText`);
    if (!altText) {
      errors.push(`${POSITION_LABEL[position]}: alt text is required with an image`);
      continue;
    }

    // linkUrl + hover description are main-card only (satellites are image-only).
    const isMain = position === 'MAIN';
    try {
      await adminFetch(`/hero-cards/${position}`, {
        method: 'PUT',
        body: {
          imageKey,
          altText,
          linkUrl: isMain ? str(form, 'MAIN_linkUrl') || null : null,
          description: isMain ? str(form, 'MAIN_description') || null : null,
        },
      });
      saved += 1;
    } catch (e) {
      errors.push(`${POSITION_LABEL[position]}: ${e instanceof Error ? e.message : 'save failed'}`);
    }
  }

  if (errors.length) return { ok: false, error: errors.join(' · ') };
  if (saved === 0) return { ok: false, error: 'Add an image to at least one card before saving.' };

  revalidateLanding();
  return { ok: true };
}

/**
 * Save the whole "Competing changes what's possible" value-prop section in one submit (M36): the
 * two promo cards (image optional → gradient fallback; link + label required) and the two stats
 * (value + label required, source optional). Fields are namespaced per slot (`vp_PRIMARY_linkUrl`,
 * `stat_SECONDARY_value`, …); each slot upserts through its per-slot PUT.
 */
export async function saveValueProp(_prev: FormState, form: FormData): Promise<FormState> {
  const errors: string[] = [];

  for (const slot of LANDING_SLOTS) {
    const linkUrl = str(form, `vp_${slot}_linkUrl`);
    const label = str(form, `vp_${slot}_label`);
    const imageKey = str(form, `vp_${slot}_imageKey`);
    if (!linkUrl || !label) {
      errors.push(`Card ${slot.toLowerCase()}: a link and a label are required`);
    } else {
      try {
        await adminFetch(`/value-prop-cards/${slot}`, {
          method: 'PUT',
          body: { imageKey: imageKey || null, linkUrl, label },
        });
      } catch (e) {
        errors.push(
          `Card ${slot.toLowerCase()}: ${e instanceof Error ? e.message : 'save failed'}`,
        );
      }
    }
  }

  for (const slot of LANDING_SLOTS) {
    const value = str(form, `stat_${slot}_value`);
    const label = str(form, `stat_${slot}_label`);
    const source = str(form, `stat_${slot}_source`);
    if (!value || !label) {
      errors.push(`Stat ${slot.toLowerCase()}: a value and a label are required`);
    } else {
      try {
        await adminFetch(`/landing-stats/${slot}`, {
          method: 'PUT',
          body: { value, label, source: source || null },
        });
      } catch (e) {
        errors.push(
          `Stat ${slot.toLowerCase()}: ${e instanceof Error ? e.message : 'save failed'}`,
        );
      }
    }
  }

  if (errors.length) return { ok: false, error: errors.join(' · ') };
  revalidateLanding();
  return { ok: true };
}

export async function setFeaturedSlots(competitionIds: string[]): Promise<void> {
  await adminFetch('/featured-slots', { method: 'PUT', body: { competitionIds } });
  revalidateLanding();
}
