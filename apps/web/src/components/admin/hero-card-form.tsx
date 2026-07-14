'use client';

import { useActionState, useEffect, useState } from 'react';
import { Alert, Button, FormField, Input, useToast } from '@beecompete/ui';
import { putHeroCard } from '@/app/admin/landing/actions';
import type { FormState, HeroCard } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

export function HeroCardForm({ position, card }: { position: string; card?: HeroCard }) {
  const [state, formAction, pending] = useActionState(putHeroCard.bind(null, position), INITIAL);
  const [imageKey, setImageKey] = useState(card?.imageKey ?? '');
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) toast({ title: `${position} hero saved`, tone: 'success' });
  }, [state.ok, position, toast]);

  const isMain = position === 'MAIN';
  // Preview only a full URL (an S3 key can't be rendered until the upload/CDN wiring lands).
  const previewSrc = /^https?:\/\//.test(imageKey) ? imageKey : null;

  return (
    // flex column + h-full so the Save button (mt-auto below) bottom-aligns across the three
    // hero columns even though MAIN has two extra fields.
    <form action={formAction} className="flex h-full flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <FormField
        label="Image (S3 key or URL)"
        required
        hint="Upload UI lands in a follow-up; enter the key (or a full image URL) for now."
      >
        <Input
          name="imageKey"
          value={imageKey}
          onChange={(e) => setImageKey(e.target.value)}
          required
          maxLength={500}
        />
      </FormField>
      {previewSrc && (
        // Arbitrary admin-entered URL (not a next/image loader domain) — internal preview only.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewSrc}
          alt=""
          className="aspect-video w-full rounded-[var(--radius-panel)] border border-border object-cover"
        />
      )}
      <FormField label="Alt text" required>
        <Input name="altText" defaultValue={card?.altText} required maxLength={300} />
      </FormField>
      {isMain && (
        <>
          <FormField label="Link URL" hint="main card only">
            <Input name="linkUrl" type="url" defaultValue={card?.linkUrl ?? ''} maxLength={1000} />
          </FormField>
          <FormField label="Hover description" hint="main card only">
            <Input name="description" defaultValue={card?.description ?? ''} maxLength={500} />
          </FormField>
        </>
      )}
      <div className="mt-auto pt-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
