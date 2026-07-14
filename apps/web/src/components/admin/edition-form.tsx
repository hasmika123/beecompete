'use client';

import { useActionState, useEffect } from 'react';
import { Alert, Button, FormField, Input, Textarea, useToast } from '@beecompete/ui';
import { FormSection } from '@/components/admin/form-section';
import { NativeSelect, enumOptions } from '@/components/admin/native-select';
import { createEdition, updateEdition } from '@/app/admin/competitions/[id]/editions/actions';
import { EDITION_STATUSES, SCOPE_LEVELS, type Edition, type FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

export function EditionForm({
  competitionId,
  edition,
  siblingEditions = [],
}: {
  competitionId: string;
  edition?: Edition;
  /** The competition's OTHER editions (self excluded) — options for the "advances to" chain (Q5). */
  siblingEditions?: { id: string; cycleLabel: string }[];
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
    <form action={formAction} className="grid max-w-3xl gap-8">
      <FormSection title="Cycle & status" cols="sm:grid-cols-3">
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
      </FormSection>

      <FormSection title="Registration" cols="sm:grid-cols-2">
        <FormField label="Registration URL">
          <Input
            name="registrationUrl"
            type="url"
            defaultValue={e?.registrationUrl ?? ''}
            maxLength={1000}
          />
        </FormField>
        <FormField label="Age cutoff date">
          <Input name="ageCutoffDate" type="date" defaultValue={e?.ageCutoffDate ?? ''} />
        </FormField>
      </FormSection>

      <FormSection title="Fees & prize" cols="sm:grid-cols-3">
        <FormField label="Entry fee">
          <Input
            name="entryFee"
            type="number"
            step="0.01"
            min={0}
            defaultValue={e?.entryFee ?? ''}
          />
        </FormField>
        <FormField label="Currency" hint="3-letter ISO, e.g. USD">
          <Input
            name="currency"
            defaultValue={e?.currency ?? ''}
            maxLength={3}
            pattern="[A-Za-z]{3}"
          />
        </FormField>
        <FormField label="Prize summary">
          <Input name="prizeSummary" defaultValue={e?.prizeSummary ?? ''} maxLength={500} />
        </FormField>
        <FormField label="Prize value">
          <Input
            name="prizeValue"
            type="number"
            step="0.01"
            min={0}
            defaultValue={e?.prizeValue ?? ''}
          />
        </FormField>
        <FormField label="Prize currency">
          <Input
            name="prizeCurrency"
            defaultValue={e?.prizeCurrency ?? ''}
            maxLength={3}
            pattern="[A-Za-z]{3}"
          />
        </FormField>
      </FormSection>

      {siblingEditions.length > 0 && (
        <FormSection title="Advancement" cols="sm:grid-cols-2">
          <FormField
            label="Advances to"
            hint="the next edition winners advance into (Q5) — e.g. state → national."
          >
            <NativeSelect
              name="advancesToEditionId"
              options={siblingEditions.map((s) => ({ value: s.id, label: s.cycleLabel }))}
              placeholder="— none —"
              defaultValue={e?.advancesToEditionId ?? ''}
            />
          </FormField>
        </FormSection>
      )}

      <FormSection title="Attributes">
        <FormField label="Attributes (JSON)" hint="Edition-specific display fields.">
          <Textarea
            name="attributes"
            defaultValue={attributesText}
            rows={4}
            className="font-mono text-xs"
            placeholder='{ "aime_cutoff": "top 2.5%" }'
          />
        </FormField>
      </FormSection>

      {/* Sticky save bar — the action (and any server error) stays visible on long forms. */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-border bg-background py-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Create edition'}
        </Button>
        {state.error && (
          <Alert tone="danger" className="min-w-0 flex-1">
            {state.error}
          </Alert>
        )}
      </div>
    </form>
  );
}
