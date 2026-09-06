import { redirect } from 'next/navigation';

/** Adding a season happens on the listing page since 2026-09-05 — see `?season=new`. */
export default async function NewEditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/competitions/${id}?season=new`);
}
