import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { ImportReview } from '@/components/admin/import-review';
import { adminFetch } from '@/lib/admin-api';
import type { ImportRecord, Page } from '@/lib/admin-types';

// The API exposes the queue by status, not by id, so find the pending record in the list.
export default async function ReviewImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pending = await adminFetch<Page<ImportRecord>>('/import-records?status=PENDING&size=200');
  const record = pending.content.find((r) => r.id === id);
  if (!record) notFound();

  return (
    <>
      <Link
        href="/admin/import-records"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Import queue
      </Link>
      <PageHeader title="Review import" />
      <ImportReview record={record} />
    </>
  );
}
