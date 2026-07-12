import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@beecompete/ui';

export const metadata: Metadata = {
  title: 'Suggest a Competition — BeeCompete',
  description: 'Know a great K-12 competition we should list? Tell our curators.',
  robots: { index: false }, // interim page — the wizard form ships at R1-15b
};

// INTERIM page: Page 6 (the multi-step suggestion wizard → DQ15) ships at R1-15b. This stub
// exists so zero-results CTAs and the footer link never dead-end.
export default function SuggestCompetitionPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl text-foreground">Suggest a competition</h1>
      <p className="mt-3 text-muted">
        Know a great K-12 competition we haven&apos;t listed? Our suggestion form is almost ready —
        check back soon. Every suggestion is reviewed by our curation team before it goes live.
      </p>
      <p className="mt-3 text-sm text-muted">
        Spotted something wrong in an <em>existing</em> listing? Use the &ldquo;Suggest a
        correction&rdquo; link on that competition&apos;s page instead.
      </p>
      <div className="mt-6">
        <Link href="/competitions" className={buttonClasses()}>
          Browse competitions
        </Link>
      </div>
    </div>
  );
}
