import Link from 'next/link';
import { Alert, ArrowRight, Card, CardContent } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminApiError, adminFetch } from '@/lib/admin-api';
import type { Category, CorrectionProposal, ImportRecord, Page } from '@/lib/admin-types';
import type { Competition, Organization } from '@/lib/admin-types';

async function counts() {
  const [competitions, organizations, categories, pendingImports, pendingCorrections] =
    await Promise.all([
      adminFetch<Page<Competition>>('/competitions?size=1'),
      adminFetch<Page<Organization>>('/organizations?size=1'),
      adminFetch<Category[]>('/categories'),
      adminFetch<Page<ImportRecord>>('/import-records?status=PENDING&size=1'),
      adminFetch<Page<CorrectionProposal>>('/corrections?status=PENDING&size=1'),
    ]);
  return {
    competitions: competitions.totalElements,
    organizations: organizations.totalElements,
    categories: categories.length,
    pendingImports: pendingImports.totalElements,
    pendingCorrections: pendingCorrections.totalElements,
  };
}

// Map a counts() failure to admin-facing guidance. A 401/403 is an auth problem (token
// blank or mismatched between the API and apps/web/.env.local); anything else is usually
// the API being unreachable at API_BASE_URL.
function diagnose(e: unknown): { title: string; hint: string } {
  if (e instanceof AdminApiError && (e.status === 401 || e.status === 403)) {
    return {
      title: `The admin API rejected the request (${e.status}).`,
      hint: 'Make sure the API is running with the same ADMIN_API_TOKEN as apps/web/.env.local. For local dev, `./gradlew bootRun` defaults it to `dev-admin-token`, matching the checked-in .env.local.',
    };
  }
  if (e instanceof AdminApiError) {
    return { title: `The admin API returned an error (${e.status}).`, hint: e.message };
  }
  return {
    title: "Couldn't reach the admin API.",
    hint: 'Check that the Spring API is running and API_BASE_URL points at it (default http://localhost:8080).',
  };
}

export default async function AdminDashboard() {
  let data: Awaited<ReturnType<typeof counts>> | null = null;
  let error: { title: string; hint: string } | null = null;
  try {
    data = await counts();
  } catch (e) {
    error = diagnose(e);
  }

  const cards = [
    { href: '/admin/competitions', label: 'Competitions', value: data?.competitions },
    { href: '/admin/organizations', label: 'Organizations', value: data?.organizations },
    { href: '/admin/categories', label: 'Categories', value: data?.categories },
    { href: '/admin/import-records', label: 'Pending imports', value: data?.pendingImports },
    { href: '/admin/corrections', label: 'Pending corrections', value: data?.pendingCorrections },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Curate the catalog and review imported records." />

      {error && (
        <Alert tone="danger" className="mb-6">
          <span className="font-medium">{error.title}</span> {error.hint}
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
