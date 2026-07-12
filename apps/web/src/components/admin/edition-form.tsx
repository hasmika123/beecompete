'use client';

import { useActionState, useEffect } from 'react';
import { Alert, Button, FormField, Input, Textarea, useToast } from '@beecompete/ui';
import { NativeSelect, enumOptions } from '@/components/admin/native-select';
import { createEdition, updateEdition } from '@/app/admin/competitions/[id]/editions/actions';
import { EDITION_STATUSES, SCOPE_LEVELS, type Edition, type FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

export function EditionForm({
  competitionId,
  edition,
}: {
  competitionId: string;
  edition?: Edition;
}) {
  const editing = edition !== undefined;
  const action = editing
    ? updateEdition.bind(null, competitionId, edition.id)
    : createEdition.bind(null, competitionId);
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) toast({ title: 'Saved', tone: 'success' });
  }, [state.ok, toast]);

  const e = edition;
  const attributesText = e?.attributes ? JSON.stringify(e.attributes, null, 2) : '';

  return (
    <form action={formAction} className="grid gap-6">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <section className="grid gap-4 sm:grid-cols-2">
        <FormField label="Cycle label" required hint="e.g. 2026">
          <Input name="cycleLabel" defaultValue={e?.cycleLabel} required maxLength={60} />
        </FormField>
        <FormField label="Status">
          <NativeSelect
            name="status"
            options={enumOptions(EDITION_STATUSES)}
            defaultValue={e?.status ?? 'UPCOMING'}
          />
        </FormField>
        <FormField label="Scope level">
          <NativeSelect
            name="scopeLevel"
            options={enumOptions(SCOPE_LEVELS)}
            defaultValue={e?.scopeLevel ?? 'NATIONAL'}
          />
        </FormField>
        <FormField label="Registration URL">
          <Input name="registrationUrl" type="url" defaultValue={e?.registrationUrl ?? ''} />
        </FormField>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <FormField label="Entry fee">
          <Input name="entryFee" type="number" step="0.01" defaultValue={e?.entryFee ?? ''} />
        </FormField>
        <FormField label="Currency" hint="ISO, e.g. USD">
          <Input name="currency" defaultValue={e?.currency ?? ''} maxLength={3} />
        </FormField>
        <FormField label="Age cutoff date">
          <Input name="ageCutoffDate" type="date" defaultValue={e?.ageCutoffDate ?? ''} />
        </FormField>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <FormField label="Prize summary" className="sm:col-span-1">
          <Input name="prizeSummary" defaultValue={e?.prizeSummary ?? ''} maxLength={500} />
        </FormField>
        <FormField label="Prize value">
          <Input name="prizeValue" type="number" step="0.01" defaultValue={e?.prizeValue ?? ''} />
        </FormField>
        <FormField label="Prize currency">
          <Input name="prizeCurrency" defaultValue={e?.prizeCurrency ?? ''} maxLength={3} />
        </FormField>
      </section>

      <FormField label="Attributes (JSON)" hint="Edition-specific display fields.">
        <Textarea
          name="attributes"
          defaultValue={attributesText}
          rows={4}
          className="font-mono text-xs"
          placeholder='{ "aime_cutoff": "top 2.5%" }'
        />
      </FormField>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Create edition'}
        </Button>
      </div>
    </form>
  );
}
