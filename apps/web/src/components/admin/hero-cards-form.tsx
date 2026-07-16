'use client';

import { useActionState, useEffect, useState } from 'react';
import { Alert, Button, FormField, ImageUpload, Input, useToast } from '@beecompete/ui';
import { saveHeroCards } from '@/app/admin/landing/actions';
import { uploadCoverImage } from '@/lib/cover-upload';
import { HERO_POSITIONS, type FormState, type HeroCard } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

const SATELLITE_HINT = 'Small decorative image · PNG, JPG, or WebP · up to 5 MB';
const MAIN_HINT = 'Large hero image · PNG, JPG, or WebP · up to 5 MB · landscape works best';

/**
 * Hero-cards editor (M36) — ONE form, ONE save. Replaces the old three-separate-forms layout
 * (each with its own Save button + misaligned columns). Structure mirrors the landing hero: a
 * full-width **Main** card (linked, hover description) above two identical **satellite** panels
 * (Top-right / Bottom-left) that align because they carry the same fields. Images upload straight
 * to S3 via {@link uploadCoverImage} (the R1-19 cover endpoint — public `covers/` prefix), with a
 * paste-a-URL fallback. Satellites are optional; a card with an image must have alt text.
 */
export function HeroCardsForm({ cards }: { cards: HeroCard[] }) {
  const [state, formAction, pending] = useActionState(saveHeroCards, INITIAL);
  const { toast } = useToast();
  const byPosition = new Map(cards.map((c) => [c.position, c]));

  // Track each card's current image so alt text is required only when an image is present.
  const [images, setImages] = useState<Record<string, string>>(() =>
    Object.fromEntries(HERO_POSITIONS.map((p) => [p, byPosition.get(p)?.imageKey ?? ''])),
  );
  const setImage = (position: string) => (url: string) =>
    setImages((prev) => ({ ...prev, [position]: url }));

  useEffect(() => {
    if (state.ok) toast({ title: 'Hero cards saved', tone: 'success' });
  }, [state.ok, toast]);

  const main = byPosition.get('MAIN');

  return (
    <form action={formAction} className="grid gap-6">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <p className="text-sm text-muted">
        These render on the landing hero — one large main card plus two decorative satellites.
        Images upload straight to storage; the satellites are optional.
      </p>

      {/* Main — full width; image beside its fields on wider screens. */}
      <section className="rounded-[var(--radius-panel)] border border-border p-4">
        <header className="mb-3">
          <h3 className="text-sm font-semibold text-foreground">Main card</h3>
          <p className="text-xs text-muted">
            The large hero image — links to a destination; a hover reveals the description over it.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageUpload
            name="MAIN_imageKey"
            defaultValue={main?.imageKey}
            hint={MAIN_HINT}
            setLabel="Main image set"
            uploadEnabled
            onSelectFile={uploadCoverImage}
            onChange={setImage('MAIN')}
          />
          <div className="grid content-start gap-4">
            <FormField label="Alt text" required={images.MAIN !== ''}>
              <Input
                name="MAIN_altText"
                defaultValue={main?.altText}
                required={images.MAIN !== ''}
                maxLength={300}
              />
            </FormField>
            <FormField
              label="Link URL"
              hint="where the card goes when clicked — a path like /competitions or a full URL"
            >
              <Input name="MAIN_linkUrl" defaultValue={main?.linkUrl ?? ''} maxLength={1000} />
            </FormField>
            <FormField label="Hover description" hint="shown over the image on hover/focus">
              <Input
                name="MAIN_description"
                defaultValue={main?.description ?? ''}
                maxLength={500}
              />
            </FormField>
          </div>
        </div>
      </section>

      {/* Satellites — identical panels, so they stay aligned. */}
      <div className="grid gap-6 sm:grid-cols-2">
        {(['TOP_RIGHT', 'BOTTOM_LEFT'] as const).map((position) => {
          const card = byPosition.get(position);
          const title = position === 'TOP_RIGHT' ? 'Top-right satellite' : 'Bottom-left satellite';
          return (
            <section
              key={position}
              className="rounded-[var(--radius-panel)] border border-border p-4"
            >
              <header className="mb-3">
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-xs text-muted">Decorative image only — optional.</p>
              </header>
              <div className="grid gap-4">
                <ImageUpload
                  name={`${position}_imageKey`}
                  defaultValue={card?.imageKey}
                  hint={SATELLITE_HINT}
                  setLabel="Image set"
                  uploadEnabled
                  onSelectFile={uploadCoverImage}
                  onChange={setImage(position)}
                />
                <FormField label="Alt text" required={images[position] !== ''}>
                  <Input
                    name={`${position}_altText`}
                    defaultValue={card?.altText}
                    required={images[position] !== ''}
                    maxLength={300}
                  />
                </FormField>
              </div>
            </section>
          );
        })}
      </div>

      {/* One save bar for all three. */}
      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <p className="text-xs text-muted">Saves all three cards at once.</p>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save hero cards'}
        </Button>
      </div>
    </form>
  );
}
