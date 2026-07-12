import Link from 'next/link';
import { Alert, ArrowRight, Card, CardContent } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { adminFetch } from '@/lib/admin-api';
import type { Category, ImportRecord, Page } from '@/lib/admin-types';
import type { Competition, Organization } from '@/lib/admin-types';

async function counts() {
  const [competitions, organizations, categories, pendingImports] = await Promise.all([
    adminFetch<Page<Competition>>('/competitions?size=1'),
    adminFetch<Page<Organization>>('/organizations?size=1'),
    adminFetch<Category[]>('/categories'),
    adminFetch<Page<ImportRecord>>('/import-records?status=PENDING&size=1'),
  ]);
  return {
    competitions: competitions.totalElements,
    organizations: organizations.totalElements,
    categories: categories.length,
    pendingImports: pendingImports.totalElements,
  };
}

export default async function AdminDashboard() {
  let data: Awaited<ReturnType<typeof counts>> | null = null;
  let error: string | null = null;
  try {
    data = await counts();
  } catch (e) {
    error = e instanceof Error ? e.message : 'could not reach the admin API';
  }

  const cards = [
    { href: '/admin/competitions', label: 'Competitions', value: data?.competitions },
    { href: '/admin/organizations', label: 'Organizations', value: data?.organizations },
    { href: '/admin/categories', label: 'Categories', value: data?.categories },
    { href: '/admin/import-records', label: 'Pending imports', value: data?.pendingImports },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Curate the catalog and review imported records." />

      {error && (
        <Alert tone="danger" className="mb-6">
          Couldn&apos;t load counts: {error}. Check that the API is running and{' '}
          <code>ADMIN_API_TOKEN</code> is set.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="group">
            <Card interactive className="h-full">
              <CardContent className="flex flex-col gap-1 p-5">
                <span className="text-sm text-muted">{card.label}</span>
                <span className="font-display text-3xl text-foreground">{card.value ?? '—'}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors group-hover:text-foreground">
                  Manage <ArrowRight aria-hidden="true" className="size-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
