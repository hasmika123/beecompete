'use client';

import { useActionState, useEffect } from 'react';
import { Alert, Button, FormField, Input, Select, Textarea, useToast } from '@beecompete/ui';
import { FormSection } from '@/components/admin/form-section';
import { AwardsInput, awardRowsFromSeed } from '@/components/admin/awards-input';
import { enumOptions } from '@/components/admin/enum-labels';
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
  // The rows editor owns `attributes.awards`; the raw JSON textarea gets the REST of the bag,
  // and the action merges the two back together — so the same key is never edited twice.
  const {
    awards: storedAwards,
    prize_display_mode: storedPrizeMode,
    ...otherAttributes
  } = (e?.attributes ?? {}) as {
    awards?: unknown;
    prize_display_mode?: unknown;
  } & Record<string, unknown>;
  const attributesText = Object.keys(otherAttributes).length
    ? JSON.stringify(otherAttributes, null, 2)
    : '';
  // Editions saved before the rows editor (2026-08-23) carry only the flat prize fields — seed
  // one row from them so legacy prizes edit as rows instead of silently vanishing.
  const initialAwards = awardRowsFromSeed(
    Array.isArray(storedAwards) && storedAwards.length > 0
      ? (storedAwards as { title: string; type?: string; value?: number; currency?: string }[])
      : e?.prizeSummary || e?.prizeValue
        ? [
            {
              title: e?.prizeSummary ?? '',
              value: e?.prizeValue ?? undefined,
              currency: e?.prizeCurrency ?? undefined,
            },
          ]
        : [],
  );

  return (
    <form action={formAction} className="grid max-w-3xl gap-8">
      <FormSection title="Cycle & status" cols="sm:grid-cols-3">
        <FormField label="Cycle label" required hint="e.g. 2026">
          <Input name="cycleLabel" defaultValue={e?.cycleLabel} required maxLength={60} />
        </FormField>
        <FormField label="Status">
          <Select
            name="status"
            options={enumOptions(EDITION_STATUSES)}
            defaultValue={e?.status ?? 'UPCOMING'}
          />
        </FormField>
        <FormField label="Scope level">
          <Select
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

      <FormSection title="Fees" cols="sm:grid-cols-3">
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
      </FormSection>

      <FormSection title="Awards">
        <FormField
          label="Award rows"
          labelAsText
          hintAs="icon"
          hint="listed in display order — the first money award leads the card; the prize summary, value and currency are derived from these rows on save."
        >
          <AwardsInput
            name="awards"
            initial={initialAwards}
            initialMode={typeof storedPrizeMode === 'string' ? storedPrizeMode : 'titles'}
            // A custom card line IS the saved summary — that's where the text round-trips from.
            initialCustom={storedPrizeMode === 'custom' ? (e?.prizeSummary ?? '') : ''}
          />
        </FormField>
      </FormSection>

      {siblingEditions.length > 0 && (
        <FormSection title="Advancement" cols="sm:grid-cols-2">
          <FormField
            label="Advances to"
            hint="the next edition winners advance into (Q5), e.g. state → national."
          >
            <Select
              name="advancesToEditionId"
              options={[
                { value: '', label: 'None' },
                ...siblingEditions.map((s) => ({ value: s.id, label: s.cycleLabel })),
              ]}
              placeholder="None"
              defaultValue={e?.advancesToEditionId ?? ''}
              searchable
            />
          </FormField>
        </FormSection>
      )}

      <FormSection title="Attributes">
        <FormField
          label="Attributes (JSON)"
          hint="edition-specific display fields — awards are edited above, not here."
        >
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
