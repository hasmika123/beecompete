import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { SuggestCorrectionForm } from './suggest-correction-form';

export function generateMetadata(): Metadata {
  // noindex: query-param variants, a utility form — not an SEO target.
  return pageMetadata({
    title: 'Suggest a correction',
    description: 'Spotted something wrong in a listing? Send our curators a fix.',
    path: '/suggest-a-correction',
    noindex: true,
  });
}

const SUBJECT_TYPES = ['COMPETITION', 'EDITION', 'RESOURCE'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public "Suggest a correction" (R1-3b, DQ6). Reached from listing pages (R1-7 links here
 * with ?subject=…&id=…&name=…); submissions land in the curator review queue — nothing is
 * published without human approval.
 */
export default async function SuggestCorrectionPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; id?: string; name?: string }>;
}) {
  const { subject: rawSubject, id, name } = await searchParams;
  const subjectType = (rawSubject ?? 'COMPETITION').toUpperCase();
  const valid =
    SUBJECT_TYPES.includes(subjectType as (typeof SUBJECT_TYPES)[number]) &&
    !!id &&
    UUID_RE.test(id);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl text-foreground">Suggest a correction</h1>
      <p className="mt-3 text-muted">
        Spotted a wrong date, fee, grade range, or link{name ? ` on ${name}` : ''}? Tell us what it
        should say — a curator reviews every suggestion before anything changes.
      </p>

      <div className="mt-8">
        {valid ? (
          <SuggestCorrectionForm subjectType={subjectType} subjectId={id} subjectName={name} />
        ) : (
          <p className="text-muted">
            This page needs to know which listing you&apos;re correcting — please use the
            &ldquo;Suggest a correction&rdquo; link on a competition page
            {/* Detail pages arrive with R1-7; until then curators reach this via direct links. */}.{' '}
            <Link href="/" className="underline hover:text-foreground">
              Back to home
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
