import { PageHeader } from '@/components/admin/page-header';
import { CollapsibleCard } from '@/components/admin/collapsible-card';
import { HeroCardsForm } from '@/components/admin/hero-cards-form';
import { ValuePropForm } from '@/components/admin/value-prop-form';
import { FeaturedManager } from '@/components/admin/featured-manager';
import { adminFetch } from '@/lib/admin-api';
import {
  type Competition,
  type FeaturedSlot,
  type HeroCard,
  type LandingStat,
  type Page,
  type ValuePropCard,
} from '@/lib/admin-types';

export default async function LandingPage() {
  const [heroCards, featured, competitions, valuePropCards, landingStats] = await Promise.all([
    adminFetch<HeroCard[]>('/hero-cards'),
    adminFetch<FeaturedSlot[]>('/featured-slots'),
    adminFetch<Page<Competition>>('/competitions?size=100'),
    adminFetch<ValuePropCard[]>('/value-prop-cards'),
    adminFetch<LandingStat[]>('/landing-stats'),
  ]);

  return (
    <>
      <PageHeader title="Landing content" description="Hero cards + featured carousel (M36)." />

      {/* Each section is a collapsible card, minimized by default (the page is long). */}
      <div className="grid gap-6">
        <CollapsibleCard title="Hero cards">
          <HeroCardsForm cards={heroCards} />
        </CollapsibleCard>

        <CollapsibleCard title="“Competing changes what’s possible” section">
          <ValuePropForm cards={valuePropCards} stats={landingStats} />
        </CollapsibleCard>

        <CollapsibleCard title="Featured carousel">
          <FeaturedManager
            allCompetitions={competitions.content.map((c) => ({
              id: c.id,
              name: c.name,
              archived: c.archivedAt !== null,
            }))}
            initial={featured.map((f) => f.competitionId)}
          />
        </CollapsibleCard>
      </div>
    </>
  );
}
