import type { Metadata } from 'next';
import { FeedbackForm } from './feedback-form';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal';
import { pageMetadata } from '@/lib/seo';

// Dynamic (no build prerender) so the (public) layout reads the analytics env at REQUEST time —
// without this the page is statically prerendered and getAnalyticsConfig() freezes to build-time
// (empty) env, silently baking analytics off for this route. Matches every other public page.
export const revalidate = 0;

export function generateMetadata(): Metadata {
  // Utility page — noindex (not SEO content), like the other form pages.
  return pageMetadata({
    title: 'Send Feedback',
    description: 'Report a bug or share an idea to help improve BeeCompete.',
    path: '/feedback',
    noindex: true,
  });
}

// R1-16: in-app bug/feedback report (DQ7 precursor). A lightweight form that emails support@
// via Brevo — no accounts/DB at R1.
export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-foreground sm:text-4xl">Send feedback</h1>
        <p className="mt-3 text-muted">
          Spotted a bug, or have an idea? We read everything — it goes straight to the team. You can
          also email us at{' '}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="font-medium text-foreground underline underline-offset-2 hover:text-brand-gold"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </header>
      <FeedbackForm />
    </div>
  );
}
