'use client';

import { useTransition } from 'react';
import { Button, Restore, Trash, useConfirm, useToast } from '@beecompete/ui';
import { archiveCompetition, restoreCompetition } from '@/app/admin/competitions/actions';

// R1-19: a competition has no verification/maintainer control of its own — that's derived from
// the organizer org (claim the org → all its competitions become host-maintained). Only
// archive/restore lives here now.
export function CompetitionHeaderActions({ id, archived }: { id: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();
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
      {archived ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => run(() => restoreCompetition(id), 'Restored')}
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
                title: 'Archive this competition?',
                message: 'It will be hidden from the public catalog. You can restore it later.',
                confirmLabel: 'Archive',
                tone: 'danger',
              })
            ) {
              run(() => archiveCompetition(id), 'Archived');
            }
          }}
        >
          <Trash aria-hidden="true" className="size-4" /> Archive
        </Button>
      )}
    </div>
  );
}
