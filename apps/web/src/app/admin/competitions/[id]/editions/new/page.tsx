import Link from 'next/link';
import { ArrowLeft } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { EditionForm } from '@/components/admin/edition-form';

export default async function NewEditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Link
        href={`/admin/competitions/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to competition
      </Link>
      <PageHeader title="New edition" />
      <EditionForm competitionId={id} />
    </>
  );
}
