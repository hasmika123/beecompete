'use client';

import { useState, useTransition } from 'react';
import { Button, Restore, Trash, useConfirm, useToast } from '@beecompete/ui';
import { MarkDuplicateDialog } from '@/components/admin/mark-duplicate-dialog';
import {
  archiveCompetition,
  restoreCompetition,
  setListingStatus,
} from '@/app/admin/competitions/actions';
import type { ListingStatus } from '@/lib/admin-types';

// R1-19: a competition has no verification/maintainer control of its own — that's derived from
// the organizer org (claim the org → all its competitions become host-maintained). Archive/restore
// lives here, and "Mark as duplicate" (DQ4 PR 2) beside Archive — it is an archive with a
// forwarding address. Of the §8a lifecycle moves (item 14) only the PAUSE pair stays up here
// (Unlist / Re-list): since 2026-09-05 publish, submit-for-review and send-back-to-draft are
// save-and-move buttons on the listing form's rail, so a reviewer's edits can never be left
// behind by the decision click. Which moves show follows the state machine — the server still
// validates, this just doesn't offer illegal ones.
export function CompetitionHeaderActions({
  id,
  name,
  archived,
  listingStatus,
}: {
  id: string;
  name: string;
  archived: boolean;
  listingStatus: ListingStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [markingDuplicate, setMarkingDuplicate] = useState(false);
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

  // label · next state · needs-confirm. The pause pair only — DRAFT/IN_REVIEW listings move
  // from the form's rail, together with a save.
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
        : [];

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
        <>
          {/* Real (bordered) buttons, not ghost text — owner 2026-09-05: they must read as
              buttons before anyone hovers. Both open a confirm, so no trailing ellipsis. */}
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => setMarkingDuplicate(true)}
          >
            Mark as duplicate
          </Button>
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
          <MarkDuplicateDialog
            id={id}
            name={name}
            open={markingDuplicate}
            onClose={() => setMarkingDuplicate(false)}
          />
        </>
      )}
    </div>
  );
}
