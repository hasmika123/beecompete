import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { CorrectionDiffTable } from '@/components/admin/correction-diff-table';
import { CorrectionReview } from '@/components/admin/correction-review';
import { ReviewOutcome } from '@/components/admin/review-outcome';
import { AdminApiError, adminFetch } from '@/lib/admin-api';
import type { CorrectionProposal } from '@/lib/admin-types';

export default async function ReviewCorrectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let proposal: CorrectionProposal;
  try {
    proposal = await adminFetch<CorrectionProposal>(`/corrections/${id}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    throw e;
  }
  const pending = proposal.status === 'PENDING';

  return (
    <>
      <Link
        href="/admin/corrections"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Corrections
      </Link>
      <PageHeader title={pending ? 'Review correction' : 'Correction'} />
      {pending ? (
        <CorrectionReview proposal={proposal} />
      ) : (
        // Reviewed — read-only outcome. "Current" reflects the record NOW (post-apply for
        // approved diffs); the note carries the submitter's text + [curator] lines.
        <div className="grid gap-6">
          <ReviewOutcome
            status={proposal.status}
            note={proposal.note}
            reviewedAt={proposal.reviewedAt}
          />
          <dl className="grid gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted">Subject:</dt>
              <dd>
                {proposal.subjectType === 'COMPETITION' ? (
                  <Link
                    href={`/admin/competitions/${proposal.subjectId}`}
                    className="hover:underline"
                  >
                    {proposal.subjectName ?? `competition ${proposal.subjectId}`}
                  </Link>
                ) : (
                  (proposal.subjectName ??
                  `${proposal.subjectType.toLowerCase()} ${proposal.subjectId}`)
                )}
              </dd>
            </div>
          </dl>
          <CorrectionDiffTable payload={proposal.payload} currentValues={proposal.currentValues} />
        </div>
      )}
    </>
  );
}
