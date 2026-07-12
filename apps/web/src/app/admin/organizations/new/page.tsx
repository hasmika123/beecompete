import Link from 'next/link';
import { ArrowLeft } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { OrganizationForm } from '@/components/admin/organization-form';

export default function NewOrganizationPage() {
  return (
    <>
      <Link
        href="/admin/organizations"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Organizations
      </Link>
      <PageHeader title="New organization" />
      <OrganizationForm />
    </>
  );
}
