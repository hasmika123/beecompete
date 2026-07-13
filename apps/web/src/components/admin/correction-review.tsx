'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Check, FormField, Textarea, X, useConfirm, useToast } from '@beecompete/ui';
import { CorrectionDiffTable } from '@/components/admin/correction-diff-table';
import { approveCorrection, rejectCorrection } from '@/app/admin/corrections/actions';
import type { CorrectionProposal, FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

/**
 * Review one user-submitted correction: current vs proposed per field, an editable diff,
 * then approve (applies the diff to the subject record) or reject.
 */
export function CorrectionReview({ proposal }: { proposal: CorrectionProposal }) {
  const [state, formAction, approving] = useActionState(
    approveCorrection.bind(null, proposal.id),
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

  return (
    <div className="grid gap-6">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {!proposal.currentValues && (
        <Alert tone="warning">The subject record no longer exists — approve will fail.</Alert>
      )}

      <dl className="grid gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted">Subject:</dt>
          <dd>
            {proposal.subjectType === 'COMPETITION' ? (
              <Link href={`/admin/competitions/${proposal.subjectId}`} className="hover:underline">
                {proposal.subjectName ?? `competition ${proposal.subjectId}`}
              </Link>
            ) : (
              (proposal.subjectName ??
              `${proposal.subjectType.toLowerCase()} ${proposal.subjectId}`)
            )}
          </dd>
        </div>
        {proposal.note && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted">Submitter note:</dt>
            <dd className="whitespace-pre-wrap">{proposal.note}</dd>
          </div>
        )}
      </dl>

      {proposal.currentValues && (
        <CorrectionDiffTable payload={proposal.payload} currentValues={proposal.currentValues} />
      )}

      <form action={formAction} className="grid gap-3">
        <FormField
          label="Diff to apply (edit before approving)"
          hint="Only whitelisted fields; approving merges this into the record through the same validation as an admin edit."
        >
          <Textarea
            name="payload"
            defaultValue={JSON.stringify(proposal.payload, null, 2)}
            rows={10}
            className="font-mono text-xs"
          />
        </FormField>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={approving || rejecting}>
            <Check aria-hidden="true" className="size-4" />{' '}
            {approving ? 'Approving…' : 'Approve & apply'}
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
              title: 'Reject this correction?',
              message: 'Rejection is final — a rejected proposal can’t be reopened for approval.',
              confirmLabel: 'Reject',
              tone: 'danger',
            });
            if (!ok) return;
            startReject(async () => {
              try {
                await rejectCorrection(proposal.id, note);
                toast({ title: 'Rejected', tone: 'success' });
                router.push('/admin/corrections');
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
