import Link from 'next/link';
import { ArrowLeft } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { CompetitionForm } from '@/components/admin/competition-form';
import { adminFetch } from '@/lib/admin-api';
import type { Category, CategoryTemplate, Organization, Page } from '@/lib/admin-types';

export default async function NewCompetitionPage() {
  const [categories, templates, organizations] = await Promise.all([
    adminFetch<Category[]>('/categories'),
    adminFetch<CategoryTemplate[]>('/categories/templates'),
    adminFetch<Page<Organization>>('/organizations?size=100'),
  ]);

  return (
    <>
      <Link
        href="/admin/competitions"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Competitions
      </Link>
      <PageHeader title="New competition" />
      <CompetitionForm
        categories={categories}
        organizations={organizations.content}
        templates={templates}
      />
    </>
  );
}
