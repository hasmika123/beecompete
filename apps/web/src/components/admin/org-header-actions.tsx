'use client';

import { useState, useTransition } from 'react';
import { Button, Restore, Trash, useConfirm, useToast } from '@beecompete/ui';
import { NativeSelect } from '@/components/admin/native-select';
import {
  archiveOrganization,
  restoreOrganization,
  setOrganizationVerification,
} from '@/app/admin/organizations/actions';

// The org trust ladder (R1-19): CURATED (unclaimed — verification N/A) → CLAIMED (host claimed,
// unverified) → VERIFIED. Claiming/verifying the org is what makes its competitions
// host-maintained (derived, no per-competition control). UNVERIFIED is retired.
const ORG_TRUST_OPTIONS = [
  { value: 'CURATED', label: 'Curated (unclaimed)' },
  { value: 'CLAIMED', label: 'Claimed (unverified)' },
  { value: 'VERIFIED', label: 'Verified' },
];

export function OrgHeaderActions({
  id,
  verificationState,
  archived,
}: {
  id: string;
  verificationState: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState(verificationState);
  const { confirm, dialog } = useConfirm();
  const { toast } = useToast();

  const run = (fn: () => Promise<void>, ok: string) =>
    startTransition(async () => {
      try {
        await fn();
        toast({ title: ok, tone: 'success' });
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : 'Action failed', tone: 'error' });
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {dialog}
      <label className="flex items-center gap-2 text-sm text-muted">
        Trust:
        <NativeSelect
          aria-label="Trust state"
          options={ORG_TRUST_OPTIONS}
          value={state}
          disabled={pending}
          className="w-52"
          onChange={(e) => {
            const next = e.target.value;
            setState(next);
            run(() => setOrganizationVerification(id, next), 'Trust state updated');
          }}
        />
      </label>
      {archived ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => run(() => restoreOrganization(id), 'Restored')}
        >
          <Restore aria-hidden="true" className="size-4" /> Restore
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={async () => {
            if (
              await confirm({
                title: 'Archive this organization?',
                message: 'You can restore it later.',
                confirmLabel: 'Archive',
                tone: 'danger',
              })
            ) {
              run(() => archiveOrganization(id), 'Archived');
            }
          }}
        >
          <Trash aria-hidden="true" className="size-4" /> Archive
        </Button>
      )}
    </div>
  );
}
