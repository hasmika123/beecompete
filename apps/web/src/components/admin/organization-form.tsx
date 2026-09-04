'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormField, Input, Select, useToast } from '@beecompete/ui';
import {
  OrganizationDuplicatesPanel,
  useDuplicateCheck,
} from '@/components/admin/duplicate-candidates';
import { enumOptions } from '@/components/admin/enum-labels';
import { FormErrorAlert } from '@/components/admin/form-error';
import { OrganizationCreatedModal } from '@/components/admin/organization-created-modal';
import {
  createOrganization,
  findOrganizationDuplicates,
  updateOrganization,
} from '@/app/admin/organizations/actions';
import { guardFormAction } from '@/lib/form-action-guard';
import { ORG_TYPES, type Organization, type OrganizationFormState } from '@/lib/admin-types';

const INITIAL: OrganizationFormState = { ok: false };

export function OrganizationForm({
  organization,
  prefill,
  onCreated,
}: {
  organization?: Organization;
  /**
   * Starting values for a CREATE, carried over from whatever asked for the organization — today
   * the pasted-JSON organizer name and the listing's official URL. Distinct from `organization`,
   * which means "edit this existing row": these are only defaults, and the curator can change any
   * of them before saving.
   */
  prefill?: { name?: string; domain?: string };
  /**
   * Set when this form is EMBEDDED in another flow (the create-listing modal). The host then owns
   * the confirmation and where dismissing it goes, so this form shows none of its own — otherwise
   * a success modal would stack on top of the modal already holding this form.
   *
   * Unset (the standalone page) means this form shows the confirmation itself and sends the
   * curator on to the organizations list.
   */
  onCreated?: (created: Organization) => void;
}) {
  const editing = organization !== undefined;
  // guardFormAction: this form also renders INSIDE the create-listing modal, where an unhandled
  // rejection (expired sign-in, dropped connection) would take the whole listing form down with it.
  const [state, formAction, pending] = useActionState(
    guardFormAction(editing ? updateOrganization.bind(null, organization.id) : createOrganization),
    INITIAL,
  );
  const { toast } = useToast();
  const router = useRouter();

  // The two identity signals, mirrored into state as they are typed (the inputs stay
  // uncontrolled) so the duplicate check below can read them.
  const [name, setName] = useState(organization?.name ?? prefill?.name ?? '');
  const [domain, setDomain] = useState(organization?.domain ?? prefill?.domain ?? '');

  // DUPLICATE CHECK (DQ4): the same lookup the save runs, before submit. Quiet on EDIT while
  // neither name nor website has changed — the server does not re-gate an unchanged row either.
  const dupName = name.trim();
  const dupDomain = domain.trim();
  const unchangedOnEdit =
    editing &&
    dupName === (organization.name ?? '').trim() &&
    dupDomain === (organization.domain ?? '').trim();
  const dupKey =
    unchangedOnEdit || (dupName.length < 3 && dupDomain === '') ? null : `${dupName}\n${dupDomain}`;
  const { result: candidates } = useDuplicateCheck(dupKey, () =>
    findOrganizationDuplicates({
      name: dupName,
      domain: dupDomain,
      excludeId: organization?.id ?? null,
    }),
  );

  // On EDIT the action returns {ok} and the page stays put, so a toast is the right weight. On
  // CREATE there is a new row to name and somewhere to go next — that gets the modal below.
  useEffect(() => {
    if (editing && state.ok) toast({ title: 'Saved', tone: 'success' });
  }, [editing, state.ok, toast]);

  const created = !editing && state.ok ? (state.organization ?? null) : null;

  // Hand off as soon as the row exists when embedded — the host renders the confirmation.
  useEffect(() => {
    if (created && onCreated) onCreated(created);
  }, [created, onCreated]);

  return (
    <>
      <form action={formAction} className="grid max-w-xl gap-5">
        <FormErrorAlert state={state} />
        <FormField label="Name" required>
          <Input
            name="name"
            defaultValue={organization?.name ?? prefill?.name}
            required
            maxLength={300}
            autoFocus={prefill?.name != null}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField label="Type">
          <Select
            name="type"
            options={enumOptions(ORG_TYPES)}
            defaultValue={organization?.type ?? 'HOST'}
          />
        </FormField>
        {/* Was labeled "Domain" (owner 2026-08-28: unclear). It asks for the organization's home on
            the web, and the server reduces whatever is typed to the registrable host — so a pasted
            address is fine and lands as maa.org either way. The hint says what gets KEPT rather
            than what to type, because that is the part a curator cannot see. */}
        <FormField
          label="Official website"
          hint="the organization’s own site — paste the address or type the domain. We store just the domain (maa.org); it’s what host verification will check later."
        >
          <Input
            name="domain"
            defaultValue={organization?.domain ?? prefill?.domain ?? ''}
            maxLength={255}
            placeholder="maa.org"
            onChange={(e) => setDomain(e.target.value)}
          />
        </FormField>
        {/* Candidates for the name/website as typed; carries the "not a duplicate" checkbox. */}
        <OrganizationDuplicatesPanel candidates={candidates} />
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Create organization'}
          </Button>
        </div>
      </form>
      {!onCreated && (
        <OrganizationCreatedModal
          organization={created}
          onClose={() => router.push('/admin/organizations')}
          returnLabel="Go to organizations"
        />
      )}
    </>
  );
}
