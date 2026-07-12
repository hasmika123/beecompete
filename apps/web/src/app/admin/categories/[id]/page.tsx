import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Card, CardContent, CardHeader, CardTitle } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { CategoryEditForm } from '@/components/admin/category-edit-form';
import { TemplateEditor } from '@/components/admin/template-editor';
import { adminFetch, AdminApiError } from '@/lib/admin-api';
import type { Category, CategoryTemplate } from '@/lib/admin-types';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const categories = await adminFetch<Category[]>('/categories');
  const category = categories.find((c) => c.id === id);
  if (!category) notFound();

  let template: CategoryTemplate | null = null;
  try {
    template = await adminFetch<CategoryTemplate>(`/categories/${id}/template`);
  } catch (e) {
    if (!(e instanceof AdminApiError && e.status === 404)) throw e;
  }

  return (
    <>
      <Link
        href="/admin/categories"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Categories
      </Link>
      <PageHeader title={category.name} />

      <div className="grid gap-6">
        <CategoryEditForm category={category} allCategories={categories} />
        <Card>
          <CardHeader className="p-5 pb-0">
            <CardTitle>Category Template</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <TemplateEditor categoryId={id} template={template} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
