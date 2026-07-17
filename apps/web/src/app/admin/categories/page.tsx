import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { AdminTable } from '@/components/admin/admin-table';
import { CategoryCreateForm } from '@/components/admin/category-create-form';
import { adminFetch } from '@/lib/admin-api';
import type { Category } from '@/lib/admin-types';

export default async function CategoriesPage() {
  const categories = await adminFetch<Category[]>('/categories');
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <PageHeader
        title="Categories"
        description="Taxonomy + Category Templates (attributes schema)."
      />

      <div className="mb-4">
        <CategoryCreateForm allCategories={categories} />
      </div>

      <AdminTable
        rows={categories}
        rowKey={(c) => c.id}
        empty="No categories yet."
        columns={[
          {
            header: 'Name',
            cell: (c) => (
              <Link href={`/admin/categories/${c.id}`} className="font-medium hover:underline">
                {c.name}
              </Link>
            ),
          },
          { header: 'Slug', cell: (c) => <span className="text-muted">{c.slug}</span> },
          {
            header: 'Parent',
            cell: (c) => (
              <span className="text-muted">
                {c.parentId ? (byId.get(c.parentId)?.name ?? '—') : '—'}
              </span>
            ),
          },
        ]}
      />
    </>
  );
}
