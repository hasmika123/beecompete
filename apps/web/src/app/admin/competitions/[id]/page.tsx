import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Badge,
  buttonClasses,
  Plus,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminTable } from '@/components/admin/admin-table';
import { enumLabel } from '@/components/admin/native-select';
import { ArchivedBadge } from '@/components/admin/status-badges';
import { CompetitionForm } from '@/components/admin/competition-form';
import { CompetitionHeaderActions } from '@/components/admin/competition-header-actions';
import { FaqManager } from '@/components/admin/faq-manager';
import { ResourceManager } from '@/components/admin/resource-manager';
import { ListingHealth } from '@/components/admin/listing-health';
import { adminFetch, AdminApiError } from '@/lib/admin-api';
import { listingHealth } from '@/lib/listing-health';
import type {
  Category,
  CategoryTemplate,
  Competition,
  Edition,
  Faq,
  Organization,
  Page,
  Resource,
} from '@/lib/admin-types';

export default async function EditCompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let competition: Competition;
  try {
    competition = await adminFetch<Competition>(`/competitions/${id}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    throw e;
  }

  const [categories, templates, organizations, editions, faqs, resources] = await Promise.all([
    adminFetch<Category[]>('/categories'),
    adminFetch<CategoryTemplate[]>('/categories/templates'),
    adminFetch<Page<Organization>>('/organizations?size=100'),
    adminFetch<Edition[]>(`/competitions/${id}/editions`),
    adminFetch<Faq[]>(`/competitions/${id}/faqs`),
    adminFetch<Resource[]>(`/competitions/${id}/resources`),
  ]);

  return (
    <>
      <Link
        href="/admin/competitions"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Competitions
      </Link>

      <PageHeader
        title={competition.name}
        actions={<CompetitionHeaderActions id={id} archived={competition.archivedAt !== null} />}
      />
      {/* R1-19: no competition-level verification badge — maintainer derives from the org. */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <ArchivedBadge archivedAt={competition.archivedAt} />
        <span>
          · provenance:{' '}
          {competition.provenanceSource ? enumLabel(competition.provenanceSource) : 'none'}
        </span>
      </div>

      <Tabs defaultValue="details">
        <TabList>
          <Tab value="details">Details</Tab>
          <Tab value="editions">Editions ({editions.length})</Tab>
          <Tab value="faq">FAQ ({faqs.length})</Tab>
          <Tab value="resources">Resources ({resources.length})</Tab>
        </TabList>

        <TabPanel value="details">
          <div className="pt-6">
            <ListingHealth checks={listingHealth(competition, editions, faqs, resources)} />
            <CompetitionForm
              competition={competition}
              categories={categories}
              organizations={organizations.content}
              templates={templates}
            />
          </div>
        </TabPanel>

        <TabPanel value="editions">
          <div className="pt-6">
            <div className="mb-3 flex justify-end">
              <Link
                href={`/admin/competitions/${id}/editions/new`}
                className={buttonClasses({ size: 'sm' })}
              >
                <Plus aria-hidden="true" className="size-4" /> New edition
              </Link>
            </div>
            <AdminTable
              rows={editions}
              rowKey={(ed) => ed.id}
              empty="No editions yet."
              columns={[
                {
                  header: 'Cycle',
                  cell: (ed) => (
                    <Link
                      href={`/admin/competitions/${id}/editions/${ed.id}`}
                      className="font-medium hover:underline"
                    >
                      {ed.cycleLabel}
                    </Link>
                  ),
                },
                {
                  header: 'Status',
                  cell: (ed) => <Badge variant="outline">{enumLabel(ed.status)}</Badge>,
                },
                {
                  header: 'Scope',
                  cell: (ed) => <Badge variant="outline">{enumLabel(ed.scopeLevel)}</Badge>,
                },
                { header: 'State', cell: (ed) => <ArchivedBadge archivedAt={ed.archivedAt} /> },
              ]}
            />
          </div>
        </TabPanel>

        <TabPanel value="faq">
          <div className="pt-6">
            <FaqManager competitionId={id} faqs={faqs} />
          </div>
        </TabPanel>

        <TabPanel value="resources">
          <div className="pt-6">
            <ResourceManager competitionId={id} resources={resources} />
          </div>
        </TabPanel>
      </Tabs>
    </>
  );
}
