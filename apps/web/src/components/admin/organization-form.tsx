'use client';

import { useActionState, useEffect } from 'react';
import { Alert, Button, FormField, Input, useToast } from '@beecompete/ui';
import { NativeSelect, enumOptions } from '@/components/admin/native-select';
import { createOrganization, updateOrganization } from '@/app/admin/organizations/actions';
import { ORG_TYPES, type FormState, type Organization } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

export function OrganizationForm({ organization }: { organization?: Organization }) {
  const editing = organization !== undefined;
  const action = editing ? updateOrganization.bind(null, organization.id) : createOrganization;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) toast({ title: 'Saved', tone: 'success' });
  }, [state.ok, toast]);

  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <FormField label="Name" required>
        <Input name="name" defaultValue={organization?.name} required maxLength={300} />
      </FormField>
      <FormField label="Type">
        <NativeSelect
          name="type"
          options={enumOptions(ORG_TYPES)}
          defaultValue={organization?.type ?? 'HOST'}
        />
      </FormField>
      <FormField label="Domain" hint="e.g. maa.org — anchors host verification later.">
        <Input name="domain" defaultValue={organization?.domain ?? ''} maxLength={255} />
      </FormField>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Create organization'}
        </Button>
      </div>
    </form>
  );
}
