'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Check, FormField, Textarea, X, useToast } from '@beecompete/ui';
import { approveCorrection, rejectCorrection } from '@/app/admin/corrections/actions';
import type { CorrectionProposal, FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

const show = (value: unknown) =>
  value === null || value === undefined ? '—' : JSON.stringify(value);

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
  const { toast } = useToast();

  useEffect(() => {
    if (state.error) toast({ title: state.error, tone: 'error' });
  }, [state.error, toast]);

  const fields = Object.keys(proposal.payload);

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
                competition {proposal.subjectId}
              </Link>
            ) : (
              `${proposal.subjectType.toLowerCase()} ${proposal.subjectId}`
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
        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">Field</th>
                <th className="px-3 py-2 font-medium">Current</th>
                <th className="px-3 py-2 font-medium">Proposed</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{field}</td>
                  <td className="px-3 py-2 text-muted">{show(proposal.currentValues?.[field])}</td>
                  <td className="px-3 py-2">{show(proposal.payload[field])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <FormField label="Reject with a note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </FormField>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          disabled={approving || rejecting}
          onClick={() =>
            startReject(async () => {
              try {
                await rejectCorrection(proposal.id, note);
                toast({ title: 'Rejected', tone: 'success' });
                router.push('/admin/corrections');
              } catch (e) {
                toast({ title: e instanceof Error ? e.message : 'Reject failed', tone: 'error' });
              }
            })
          }
        >
          <X aria-hidden="true" className="size-4" /> Reject
        </Button>
      </div>
    </div>
  );
}
