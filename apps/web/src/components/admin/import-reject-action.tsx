'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormField, Modal, Textarea, X, useToast } from '@beecompete/ui';
import { rejectImport } from '@/app/admin/import-records/actions';

/**
 * Reject one queued extraction, with an optional note.
 *
 * IN THE RAIL, BESIDE APPROVE (owner 2026-09-05). It used to be a panel at the FOOT of the page —
 * a permanently-open note box and a Reject button, a long scroll away from the Approve it is the
 * alternative to. A reviewer deciding between the two had to hold both in their head while
 * looking at only one. The two decisions now sit together, and the note moved into the modal that
 * already had to exist to confirm: a reject is final, and almost none of them carry a note, so
 * the field belongs on the confirm step rather than occupying the page until someone uses it.
 *
 * Still OUTSIDE the review tabs' editing surfaces for the original reason: rejecting is a
 * decision about the RECORD, not about whichever editor is on screen.
 */
export function ImportRejectAction({ recordId }: { recordId: string }) {
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const [rejecting, startReject] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const reject = () =>
    startReject(async () => {
      try {
        await rejectImport(recordId, note);
        toast({ title: 'Rejected', tone: 'success' });
        router.push('/admin/import-records');
      } catch (e) {
        setOpen(false);
        toast({ title: e instanceof Error ? e.message : 'Reject failed', tone: 'error' });
      }
    });

  return (
    <>
      {/* type="button": this renders inside the review form, and a bare button would submit it. */}
      <Button
        type="button"
        variant="ghost"
        disabled={rejecting}
        onClick={() => setOpen(true)}
        className="w-full"
      >
        <X aria-hidden="true" className="size-4" /> Reject
      </Button>
      {/* Modal portals to document.body, so the note textarea never posts with the review form. */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reject this import?"
        description="Rejection is final. A rejected record can’t be reopened for approval."
        className="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={rejecting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={reject} disabled={rejecting}>
              {rejecting ? 'Rejecting…' : 'Reject'}
            </Button>
          </div>
        }
      >
        <FormField
          label="Note (optional)"
          hint="Why this extraction is unusable — kept on the record."
        >
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </FormField>
      </Modal>
    </>
  );
}
