'use client';

import { useTransition } from 'react';
import { Button, Restore, Trash, useConfirm, useToast } from '@beecompete/ui';
import {
  archiveCompetition,
  restoreCompetition,
  setListingStatus,
} from '@/app/admin/competitions/actions';
import type { ListingStatus } from '@/lib/admin-types';

// R1-19: a competition has no verification/maintainer control of its own — that's derived from
// the organizer org (claim the org → all its competitions become host-maintained). Archive/restore
// plus the §8a lifecycle moves (item 14) live here. Which moves show follows the state machine —
// the server still validates, this just doesn't offer illegal ones.
export function CompetitionHeaderActions({
  id,
  archived,
  listingStatus,
}: {
  id: string;
  archived: boolean;
  listingStatus: ListingStatus;
}) {
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

  // label · next state · needs-confirm. Publish from DRAFT/IN_REVIEW, the pause pair on the rest.
  const moves: Array<{ label: string; next: ListingStatus; confirmMsg?: string }> = archived
    ? []
    : listingStatus === 'PUBLISHED'
      ? [
          {
            label: 'Unlist',
            next: 'UNLISTED',
            confirmMsg: 'The listing disappears from the public catalog until you re-list it.',
          },
        ]
      : listingStatus === 'UNLISTED'
        ? [{ label: 'Re-list', next: 'PUBLISHED' }]
        : [
            { label: 'Publish', next: 'PUBLISHED' },
            ...(listingStatus === 'DRAFT'
              ? [{ label: 'Submit for review', next: 'IN_REVIEW' as ListingStatus }]
              : [{ label: 'Send back to draft', next: 'DRAFT' as ListingStatus }]),
          ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {dialog}
      {moves.map((move) => (
        <Button
          key={move.next}
          variant={move.next === 'PUBLISHED' ? 'brand' : 'secondary'}
          size="sm"
          disabled={pending}
          onClick={async () => {
            if (move.confirmMsg) {
              const okConfirm = await confirm({
                title: `${move.label} this competition?`,
                message: move.confirmMsg,
                confirmLabel: move.label,
                tone: 'danger',
              });
              if (!okConfirm) return;
            }
            run(
              () => setListingStatus(id, move.next),
              move.label === 'Unlist' ? 'Unlisted' : 'Done',
            );
          }}
        >
          {move.label}
        </Button>
      ))}
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
