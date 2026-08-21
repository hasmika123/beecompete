'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormField, Textarea, X, useConfirm, useToast } from '@beecompete/ui';
import { rejectImport } from '@/app/admin/import-records/actions';

/**
 * Reject one queued extraction, with a note.
 *
 * Split out of the review form so it sits OUTSIDE the review tabs: rejecting is a decision about
 * the record, not about whichever editing surface the curator happens to be looking at, and
 * duplicating it per tab would have meant two of these on screen.
 */
export function ImportRejectPanel({ recordId }: { recordId: string }) {
  const [note, setNote] = useState('');
  const [rejecting, startReject] = useTransition();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { toast } = useToast();

  return (
    <div className="rounded-[var(--radius-panel)] border border-border p-4">
      {dialog}
      <FormField
        label="Note (optional)"
        hint="Why this extraction is unusable — kept on the record."
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </FormField>
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        disabled={rejecting}
        onClick={async () => {
          const ok = await confirm({
            title: 'Reject this import?',
            message: 'Rejection is final. A rejected record can’t be reopened for approval.',
            confirmLabel: 'Reject',
            tone: 'danger',
          });
          if (!ok) return;
          startReject(async () => {
            try {
              await rejectImport(recordId, note);
              toast({ title: 'Rejected', tone: 'success' });
              router.push('/admin/import-records');
            } catch (e) {
              toast({ title: e instanceof Error ? e.message : 'Reject failed', tone: 'error' });
            }
          });
        }}
      >
        <X aria-hidden="true" className="size-4" /> Reject
      </Button>
    </div>
  );
}
