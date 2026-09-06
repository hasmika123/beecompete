import { redirect } from 'next/navigation';

/**
 * The per-season edit page is gone (2026-09-05): every season, old or new, opens in the listing
 * page's own form via `?season=`. Old links and bookmarks land there.
 */
export default async function EditEditionPage({
  params,
}: {
  params: Promise<{ id: string; editionId: string }>;
}) {
  const { id, editionId } = await params;
  redirect(`/admin/competitions/${id}?season=${editionId}`);
}
