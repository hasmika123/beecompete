'use client';

import { useState, useTransition } from 'react';
import { Button, Trash, useToast } from '@beecompete/ui';
import { NativeSelect, enumOptions } from '@/components/admin/native-select';
import { VERIFICATION_STATES } from '@/lib/admin-types';
import {
  archiveOrganization,
  setOrganizationVerification,
} from '@/app/admin/organizations/actions';

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
      <NativeSelect
        aria-label="Verification state"
        options={enumOptions(VERIFICATION_STATES)}
        value={state}
        disabled={pending}
        className="w-40"
        onChange={(e) => {
          const next = e.target.value;
          setState(next);
          run(() => setOrganizationVerification(id, next), 'Verification updated');
        }}
      />
      {!archived && (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => run(() => archiveOrganization(id), 'Archived')}
        >
          <Trash aria-hidden="true" className="size-4" /> Archive
        </Button>
      )}
    </div>
  );
}
