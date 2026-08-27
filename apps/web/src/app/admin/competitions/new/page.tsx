import { NewCompetitionClient } from '@/components/admin/new-competition-client';
import { adminFetch } from '@/lib/admin-api';
import type { Category, CategoryTemplate, Organization, Page, Region } from '@/lib/admin-types';

export default async function NewCompetitionPage() {
  const [categories, templates, organizations, regions] = await Promise.all([
    adminFetch<Category[]>('/categories'),
    adminFetch<CategoryTemplate[]>('/categories/templates'),
    adminFetch<Page<Organization>>('/organizations?size=100'),
    adminFetch<Region[]>('/regions'),
  ]);

  // The back link + page title live in the create form's own header (so the completion ring can
  // align to the back-link line); this page just supplies the data. The client wrapper adds the
  // paste-JSON pre-fill (and remounts the form per paste) around the same CompetitionForm.
  return (
    <NewCompetitionClient
      categories={categories}
      organizations={organizations.content}
      templates={templates}
      regions={regions}
    />
  );
}
