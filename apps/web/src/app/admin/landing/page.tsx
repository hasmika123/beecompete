import { Card, CardContent, CardHeader, CardTitle } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { enumLabel } from '@/components/admin/native-select';
import { HeroCardForm } from '@/components/admin/hero-card-form';
import { FeaturedManager } from '@/components/admin/featured-manager';
import { adminFetch } from '@/lib/admin-api';
import {
  HERO_POSITIONS,
  type Competition,
  type FeaturedSlot,
  type HeroCard,
  type Page,
} from '@/lib/admin-types';

export default async function LandingPage() {
  const [heroCards, featured, competitions] = await Promise.all([
    adminFetch<HeroCard[]>('/hero-cards'),
    adminFetch<FeaturedSlot[]>('/featured-slots'),
    adminFetch<Page<Competition>>('/competitions?size=100'),
  ]);

  const byPosition = new Map(heroCards.map((h) => [h.position, h]));

  return (
    <>
      <PageHeader title="Landing content" description="Hero cards + featured carousel (M36)." />

      <div className="grid gap-6">
        <Card>
          <CardHeader className="p-5 pb-0">
            <CardTitle>Hero cards</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 p-5 lg:grid-cols-3">
            {HERO_POSITIONS.map((position) => (
              <div key={position} className="grid gap-3">
                <h3 className="text-sm font-semibold text-foreground">{enumLabel(position)}</h3>
                <HeroCardForm position={position} card={byPosition.get(position)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-0">
            <CardTitle>Featured carousel</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <FeaturedManager
              allCompetitions={competitions.content.map((c) => ({
                id: c.id,
                name: c.name,
                archived: c.archivedAt !== null,
              }))}
              initial={featured.map((f) => f.competitionId)}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
