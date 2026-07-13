'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Check, FormField, Textarea, X, useConfirm, useToast } from '@beecompete/ui';
import { approveImport, rejectImport } from '@/app/admin/import-records/actions';
import type { FormState, ImportRecord } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

/** Review one queued import: edit the extracted payload, then approve (creates the Competition) or reject. */
export function ImportReview({ record }: { record: ImportRecord }) {
  const [state, formAction, approving] = useActionState(
    approveImport.bind(null, record.id),
    INITIAL,
  );
  const [rejecting, startReject] = useTransition();
  const [note, setNote] = useState('');
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { toast } = useToast();

  useEffect(() => {
    if (state.error) toast({ title: state.error, tone: 'error' });
  }, [state.error, toast]);

  const payloadText = JSON.stringify(record.payload, null, 2);

  return (
    <div className="grid gap-6">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <dl className="grid gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted">Source:</dt>
          <dd>
            {record.sourceUrl ? (
              <a
                href={record.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {record.sourceUrl}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">Confidence:</dt>
          <dd>{record.confidence ?? '—'}</dd>
        </div>
      </dl>

      <form action={formAction} className="grid gap-3">
        <FormField
          label="Extracted payload (edit before approving)"
          hint="Approving validates this against the category template and creates the competition (provenance = import)."
        >
          <Textarea
            name="payload"
            defaultValue={payloadText}
            rows={18}
            className="font-mono text-xs"
          />
        </FormField>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={approving || rejecting}>
            <Check aria-hidden="true" className="size-4" />{' '}
            {approving ? 'Approving…' : 'Approve & create'}
          </Button>
        </div>
      </form>

      <div className="rounded-[var(--radius-panel)] border border-border p-4">
        {dialog}
        <FormField label="Note (optional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </FormField>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          disabled={approving || rejecting}
          onClick={async () => {
            const ok = await confirm({
              title: 'Reject this import?',
              message: 'Rejection is final — a rejected record can’t be reopened for approval.',
              confirmLabel: 'Reject',
              tone: 'danger',
            });
            if (!ok) return;
            startReject(async () => {
              try {
                await rejectImport(record.id, note);
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
    </div>
  );
}
