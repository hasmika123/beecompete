'use client';

import { useTransition } from 'react';
import { Button, useToast } from '@beecompete/ui';
import { setListingStatus } from '@/app/admin/competitions/actions';

/**
 * The review queue's per-row decision (§8a): publish, or send back to draft. Kept to the two
 * moves a REVIEWER makes — everything else (editing, unlisting) belongs on the listing's own
 * page, one click away on the row's name.
 */
export function ReviewListingActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const run = (status: 'PUBLISHED' | 'DRAFT', ok: string) =>
    startTransition(async () => {
      try {
        await setListingStatus(id, status);
        toast({ title: ok, tone: 'success' });
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : 'Action failed', tone: 'error' });
      }
    });

  return (
    <span className="flex justify-end gap-2">
      <Button
        variant="brand"
        size="sm"
        disabled={pending}
        onClick={() => run('PUBLISHED', 'Published')}
      >
        Publish
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run('DRAFT', 'Sent back to draft')}
      >
        Send back
      </Button>
    </span>
  );
}
