'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, FormField, Input, Textarea, cn, useToast } from '@beecompete/ui';
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

// Titled, evenly-spaced group with a top rule — gives the long form a scannable structure
// instead of one undifferentiated column of fields.
function FormSection({
  title,
  description,
  cols,
  children,
}: {
  title: string;
  description?: string;
  cols?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 className="font-display text-base text-foreground">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      <div className={cn('grid gap-4', cols)}>{children}</div>
    </section>
  );
}

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

  // Team size only applies to team/both participation — gate the inputs (disabled fields aren't
  // submitted, so INDIVIDUAL never posts a stray team size).
  const [participation, setParticipation] = useState(c?.participationMode ?? 'INDIVIDUAL');
  const teamDisabled = participation === 'INDIVIDUAL';

  return (
    <form action={formAction} className="grid gap-8">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <FormSection title="Basics" cols="sm:grid-cols-2">
        <FormField label="Name" required>
          <Input name="name" defaultValue={c?.name} required maxLength={300} />
        </FormField>
        <FormField label="Slug" required hint="lowercase-kebab-case; permanent (SEO).">
          <Input
            name="slug"
            defaultValue={c?.slug}
            required
            maxLength={160}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
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
      </FormSection>

      <FormSection title="Description" description="Shown on the card and the About tab.">
        <FormField label="Summary" hint="1–2 sentences shown on the card (max 300 chars).">
          <Textarea name="summary" defaultValue={c?.summary ?? ''} maxLength={300} rows={2} />
        </FormField>
        <FormField
          label="Description"
          hint="Full write-up (About tab). Write our own — never paste theirs."
        >
          <Textarea name="description" defaultValue={c?.description ?? ''} rows={5} />
        </FormField>
      </FormSection>

      <FormSection title="Format" cols="sm:grid-cols-3">
        <FormField label="Participation">
          <NativeSelect
            name="participationMode"
            options={enumOptions(PARTICIPATION_MODES)}
            value={participation}
            onChange={(e) => setParticipation(e.target.value)}
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
        <FormField label="Team size (min)" hint="team competitions only">
          <Input
            name="teamSizeMin"
            type="number"
            defaultValue={c?.teamSizeMin ?? ''}
            min={1}
            disabled={teamDisabled}
          />
        </FormField>
        <FormField label="Team size (max)" hint="team competitions only">
          <Input
            name="teamSizeMax"
            type="number"
            defaultValue={c?.teamSizeMax ?? ''}
            min={1}
            disabled={teamDisabled}
          />
        </FormField>
      </FormSection>

      <FormSection title="Eligibility" cols="sm:grid-cols-4">
        <FormField label="Min grade" hint="Pre-K −1, K 0">
          <Input name="minGrade" type="number" defaultValue={c?.minGrade ?? ''} min={-1} max={12} />
        </FormField>
        <FormField label="Max grade">
          <Input name="maxGrade" type="number" defaultValue={c?.maxGrade ?? ''} min={-1} max={12} />
        </FormField>
        <FormField label="Min age">
          <Input name="minAge" type="number" defaultValue={c?.minAge ?? ''} min={0} max={25} />
        </FormField>
        <FormField label="Max age">
          <Input name="maxAge" type="number" defaultValue={c?.maxAge ?? ''} min={0} max={25} />
        </FormField>
      </FormSection>

      <FormSection title="Classification & links" cols="sm:grid-cols-2">
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
          <Input
            name="officialUrl"
            type="url"
            defaultValue={c?.officialUrl ?? ''}
            maxLength={1000}
          />
        </FormField>
        <FormField label="Logo (S3 key or URL)">
          <Input name="logo" defaultValue={c?.logo ?? ''} maxLength={1000} />
        </FormField>
      </FormSection>

      <FormSection
        title="Category attributes"
        description="Category-specific fields — validated against the category template on save."
      >
        <FormField label="Attributes (JSON)">
          <Textarea
            name="attributes"
            defaultValue={attributesText}
            rows={6}
            className="font-mono text-xs"
            placeholder='{ "topics": ["algebra"] }'
          />
        </FormField>
      </FormSection>

      {/* Dates aren't part of the competition record — they live on its Editions (D3, timeline
          as data). Surface where to set them, since admins expect a "deadline" field here. */}
      <Alert tone="info">
        Dates &amp; deadlines aren&apos;t set here — they live on the competition&apos;s{' '}
        <strong>Editions</strong>. After saving, open the competition, add an Edition, then add its
        key dates (registration close, submission due, results).
      </Alert>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Create competition'}
        </Button>
      </div>
    </form>
  );
}
