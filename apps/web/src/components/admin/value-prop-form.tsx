'use client';

import { useActionState, useEffect } from 'react';
import { Alert, Button, FormField, ImageUpload, Input, useToast } from '@beecompete/ui';
import { saveValueProp } from '@/app/admin/landing/actions';
import { uploadCoverImage } from '@/lib/cover-upload';
import {
  LANDING_SLOTS,
  type FormState,
  type LandingStat,
  type ValuePropCard,
} from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

const CARD_TITLE: Record<string, string> = { PRIMARY: 'Left card', SECONDARY: 'Right card' };
const STAT_TITLE: Record<string, string> = { PRIMARY: 'First stat', SECONDARY: 'Second stat' };
const IMAGE_HINT =
  'Optional — leave empty to keep the gradient placeholder · PNG/JPG/WebP · up to 5 MB';

/**
 * Editor for the landing "Competing changes what's possible" section (M36) — ONE form, ONE save:
 * the two promo image cards (image optional → gradient fallback, plus link + label) and the two
 * admissions stats (value + text + optional source). Slot order (Primary, Secondary) matches the
 * on-page order (left/right cards, first/second stat). Images upload to S3 via `uploadCoverImage`.
 */
export function ValuePropForm({ cards, stats }: { cards: ValuePropCard[]; stats: LandingStat[] }) {
  const [state, formAction, pending] = useActionState(saveValueProp, INITIAL);
  const { toast } = useToast();
  const cardBy = new Map(cards.map((c) => [c.position, c]));
  const statBy = new Map(stats.map((s) => [s.position, s]));

  useEffect(() => {
    if (state.ok) toast({ title: 'Section saved', tone: 'success' });
  }, [state.ok, toast]);

  return (
    <form action={formAction} className="grid gap-8">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      {/* Promo image cards */}
      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Promo cards</h3>
          <p className="text-xs text-muted">
            The two clickable image cards. Leave the image empty to keep the current gradient look.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {LANDING_SLOTS.map((slot) => {
            const card = cardBy.get(slot);
            return (
              <section
                key={slot}
                className="grid gap-4 rounded-[var(--radius-panel)] border border-border p-4"
              >
                <h4 className="text-sm font-semibold text-foreground">{CARD_TITLE[slot]}</h4>
                <ImageUpload
                  name={`vp_${slot}_imageKey`}
                  defaultValue={card?.imageKey}
                  hint={IMAGE_HINT}
                  setLabel="Image set"
                  uploadEnabled
                  onSelectFile={uploadCoverImage}
                />
                <FormField label="Link URL" required hint="a path like /competitions or a full URL">
                  <Input
                    name={`vp_${slot}_linkUrl`}
                    defaultValue={card?.linkUrl}
                    required
                    maxLength={1000}
                  />
                </FormField>
                <FormField label="Label" required hint="the text shown on hover">
                  <Input
                    name={`vp_${slot}_label`}
                    defaultValue={card?.label}
                    required
                    maxLength={200}
                  />
                </FormField>
              </section>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Stats</h3>
          <p className="text-xs text-muted">
            The two figures beside the cards. Keep a source line — the numbers should be sourced and
            non-causal before launch.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {LANDING_SLOTS.map((slot) => {
            const stat = statBy.get(slot);
            return (
              <section
                key={slot}
                className="grid gap-4 rounded-[var(--radius-panel)] border border-border p-4"
              >
                <h4 className="text-sm font-semibold text-foreground">{STAT_TITLE[slot]}</h4>
                <FormField label="Value" required hint='the prominent figure, e.g. "72%"'>
                  <Input
                    name={`stat_${slot}_value`}
                    defaultValue={stat?.value}
                    required
                    maxLength={60}
                  />
                </FormField>
                <FormField label="Text" required hint="the descriptive line under the value">
                  <Input
                    name={`stat_${slot}_label`}
                    defaultValue={stat?.label}
                    required
                    maxLength={300}
                  />
                </FormField>
                <FormField label="Source" hint="attribution shown as “— Source: …” (optional)">
                  <Input
                    name={`stat_${slot}_source`}
                    defaultValue={stat?.source ?? ''}
                    maxLength={300}
                  />
                </FormField>
              </section>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <p className="text-xs text-muted">Saves the whole section at once.</p>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save section'}
        </Button>
      </div>
    </form>
  );
}
