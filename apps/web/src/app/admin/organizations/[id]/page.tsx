import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { OrganizationForm } from '@/components/admin/organization-form';
import { OrgHeaderActions } from '@/components/admin/org-header-actions';
import { ArchivedBadge } from '@/components/admin/status-badges';
import { adminFetch, AdminApiError } from '@/lib/admin-api';
import type { Organization } from '@/lib/admin-types';

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let organization: Organization;
  try {
    organization = await adminFetch<Organization>(`/organizations/${id}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <>
      <Link
        href="/admin/organizations"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Organizations
      </Link>
      <PageHeader
        title={organization.name}
        actions={
          <OrgHeaderActions
            id={id}
            verificationState={organization.verificationState}
            archived={organization.archivedAt !== null}
          />
        }
      />
      <div className="mb-6">
        <ArchivedBadge archivedAt={organization.archivedAt} />
      </div>
      <OrganizationForm organization={organization} />
    </>
  );
}
