import { PageHeader } from '@/components/admin/page-header';
import { RegionAdmin } from '@/components/admin/region-admin';
import { adminFetch } from '@/lib/admin-api';
import type { Region } from '@/lib/admin-types';

export default async function RegionsPage() {
  const regions = await adminFetch<Region[]>('/regions');
  return (
    <>
      <PageHeader
        title="Regions"
        description="The geography tree that tags editions (country → state → …)."
      />
      <RegionAdmin regions={regions} />
    </>
  );
}
