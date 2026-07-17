import type { Metadata } from 'next';
import { RequestWizard } from './request-wizard';
import { pageMetadata } from '@/lib/seo';

// Dynamic (reads searchParams for the zero-results prefill) — inherits the site-wide indexing
// gate via pageMetadata (interim noindex stub dropped now that the real wizard ships).
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Request a Competition',
    description:
      'Know a great K-12 competition we haven’t listed yet? Tell our curation team and we’ll review it for the catalog.',
    path: '/suggest-a-competition',
  });
}

// Page 6 (DQ15): the multi-step Request-a-Competition wizard → import/curation queue (R1-15b).
// Zero-results referrals prefill step 1 from the logged query (?q=, → X20).
export default async function SuggestCompetitionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-foreground sm:text-4xl">Request a competition</h1>
        <p className="mt-3 text-muted">
          Know a great K-12 competition we haven&apos;t listed? Tell us about it — a few quick
          questions and our curation team takes it from there. Every request is reviewed by a human
          before anything goes live.
        </p>
      </header>
      <RequestWizard initialName={q?.slice(0, 200) ?? ''} />
    </div>
  );
}
