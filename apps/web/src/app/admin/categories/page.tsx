import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminTable } from '@/components/admin/admin-table';
import { CategoryCreateForm } from '@/components/admin/category-create-form';
import { RegionManager } from '@/components/admin/region-manager';
import { adminFetch } from '@/lib/admin-api';
import type { Category, Region } from '@/lib/admin-types';

export default async function CategoriesPage() {
  const [categories, regions] = await Promise.all([
    adminFetch<Category[]>('/categories'),
    adminFetch<Region[]>('/regions'),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <PageHeader
        title="Categories"
        description="Taxonomy + Category Templates (attributes schema)."
      />

      <div className="mb-4">
        <CategoryCreateForm />
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

      <Card className="mt-8">
        <CardHeader className="p-5 pb-0">
          <CardTitle>Regions</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <RegionManager regions={regions} />
        </CardContent>
      </Card>
    </>
  );
}
