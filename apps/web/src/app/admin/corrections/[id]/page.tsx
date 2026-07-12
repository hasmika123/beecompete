import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { CorrectionReview } from '@/components/admin/correction-review';
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

  return (
    <>
      <Link
        href="/admin/corrections"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Corrections
      </Link>
      <PageHeader title="Review correction" />
      <CorrectionReview proposal={proposal} />
    </>
  );
}
