'use client';

import { useActionState, useEffect } from 'react';
import { Alert, Button, FormField, Input, useToast } from '@beecompete/ui';
import { putHeroCard } from '@/app/admin/landing/actions';
import type { FormState, HeroCard } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

export function HeroCardForm({ position, card }: { position: string; card?: HeroCard }) {
  const [state, formAction, pending] = useActionState(putHeroCard.bind(null, position), INITIAL);
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) toast({ title: `${position} hero saved`, tone: 'success' });
  }, [state.ok, position, toast]);

  const isMain = position === 'MAIN';

  return (
    <form action={formAction} className="grid gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <FormField
        label="Image key (S3)"
        required
        hint="Upload UI lands in a follow-up; enter the key for now."
      >
        <Input name="imageKey" defaultValue={card?.imageKey} required maxLength={500} />
      </FormField>
      <FormField label="Alt text" required>
        <Input name="altText" defaultValue={card?.altText} required maxLength={300} />
      </FormField>
      {isMain && (
        <>
          <FormField label="Link URL" hint="main card only">
            <Input name="linkUrl" defaultValue={card?.linkUrl ?? ''} maxLength={1000} />
          </FormField>
          <FormField label="Hover description" hint="main card only">
            <Input name="description" defaultValue={card?.description ?? ''} maxLength={500} />
          </FormField>
        </>
      )}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
