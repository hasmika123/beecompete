'use client';

import { useActionState, useEffect } from 'react';
import { Alert, Button, FormField, Input, Textarea, useToast } from '@beecompete/ui';
import { NativeSelect, enumOptions } from '@/components/admin/native-select';
import { createCompetition, updateCompetition } from '@/app/admin/competitions/actions';
import {
  COST_TYPES,
  DELIVERIES,
  ENTRY_PATHWAYS,
  PARTICIPATION_MODES,
  RECURRENCES,
  type Category,
  type Competition,
  type FormState,
  type Organization,
} from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

export function CompetitionForm({
  competition,
  categories,
  organizations,
}: {
  competition?: Competition;
  categories: Category[];
  organizations: Organization[];
}) {
  const editing = competition !== undefined;
  const action = editing ? updateCompetition.bind(null, competition.id) : createCompetition;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) toast({ title: 'Saved', tone: 'success' });
  }, [state.ok, toast]);

  const c = competition;
  const categoryOptions = categories.map((cat) => ({ value: cat.id, label: cat.name }));
  const orgOptions = organizations.map((o) => ({ value: o.id, label: o.name }));
  const attributesText = c?.attributes ? JSON.stringify(c.attributes, null, 2) : '';

  return (
    <form action={formAction} className="grid gap-6">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <section className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" required>
          <Input name="name" defaultValue={c?.name} required maxLength={300} />
        </FormField>
        <FormField label="Slug" required hint="lowercase-kebab-case; permanent (SEO).">
          <Input name="slug" defaultValue={c?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        </FormField>
        <FormField label="Category" required>
          <NativeSelect
            name="categoryId"
            options={categoryOptions}
            placeholder="Select category…"
            defaultValue={c?.categoryId ?? ''}
            required
          />
        </FormField>
        <FormField label="Organizer" hint="the organization the verified seal attaches to.">
          <NativeSelect
            name="organizerOrgId"
            options={orgOptions}
            placeholder="— none —"
            defaultValue={c?.organizerOrgId ?? ''}
          />
        </FormField>
      </section>

      <FormField label="Summary" hint="1–2 sentences shown on the card (max 300 chars).">
        <Textarea name="summary" defaultValue={c?.summary ?? ''} maxLength={300} rows={2} />
      </FormField>

      <FormField
        label="Description"
        hint="Full write-up (About tab). Write our own — never paste theirs."
      >
        <Textarea name="description" defaultValue={c?.description ?? ''} rows={5} />
      </FormField>

      <section className="grid gap-4 sm:grid-cols-3">
        <FormField label="Participation">
          <NativeSelect
            name="participationMode"
            options={enumOptions(PARTICIPATION_MODES)}
            defaultValue={c?.participationMode ?? 'INDIVIDUAL'}
          />
        </FormField>
        <FormField label="Delivery">
          <NativeSelect
            name="delivery"
            options={enumOptions(DELIVERIES)}
            defaultValue={c?.delivery ?? 'IN_PERSON'}
          />
        </FormField>
        <FormField label="Entry pathway">
          <NativeSelect
            name="entryPathway"
            options={enumOptions(ENTRY_PATHWAYS)}
            defaultValue={c?.entryPathway ?? 'INDIVIDUAL'}
          />
        </FormField>
        <FormField label="Cost">
          <NativeSelect
            name="costType"
            options={enumOptions(COST_TYPES)}
            defaultValue={c?.costType ?? 'FREE'}
          />
        </FormField>
        <FormField label="Recurrence">
          <NativeSelect
            name="recurrence"
            options={enumOptions(RECURRENCES)}
            defaultValue={c?.recurrence ?? 'ANNUAL'}
          />
        </FormField>
      </section>

      <section className="grid gap-4 sm:grid-cols-4">
        <FormField label="Min grade" hint="Pre-K −1, K 0">
          <Input name="minGrade" type="number" defaultValue={c?.minGrade ?? ''} min={-1} max={13} />
        </FormField>
        <FormField label="Max grade">
          <Input name="maxGrade" type="number" defaultValue={c?.maxGrade ?? ''} min={-1} max={13} />
        </FormField>
        <FormField label="Min age">
          <Input name="minAge" type="number" defaultValue={c?.minAge ?? ''} min={0} />
        </FormField>
        <FormField label="Max age">
          <Input name="maxAge" type="number" defaultValue={c?.maxAge ?? ''} min={0} />
        </FormField>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <FormField label="Tags" hint="comma-separated">
          <Input name="tags" defaultValue={c?.tags?.join(', ') ?? ''} />
        </FormField>
        <FormField
          label="Evaluation types"
          hint="comma-separated, allowed: exam, submission, live_performance, interview, portfolio"
        >
          <Input name="evaluationType" defaultValue={c?.evaluationType?.join(', ') ?? ''} />
        </FormField>
        <FormField label="Official URL">
          <Input name="officialUrl" type="url" defaultValue={c?.officialUrl ?? ''} />
        </FormField>
        <FormField label="Logo (S3 key or URL)">
          <Input name="logo" defaultValue={c?.logo ?? ''} />
        </FormField>
      </section>

      <FormField
        label="Attributes (JSON)"
        hint="Category-specific fields — validated against the category template on save."
      >
        <Textarea
          name="attributes"
          defaultValue={attributesText}
          rows={6}
          className="font-mono text-xs"
          placeholder='{ "topics": ["algebra"] }'
        />
      </FormField>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Create competition'}
        </Button>
      </div>
    </form>
  );
}
