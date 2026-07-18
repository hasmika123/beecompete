import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle, buttonClasses, cn } from '@beecompete/ui';
import { isSubscriptionFlow, type SubscriptionFlow } from '@/lib/subscription-flows';
import { pageMetadata } from '@/lib/seo';

// Post-confirmation landing for the double-opt-in email captures (R1-15c). Brevo sends the
// subscriber here after they click confirm — previously they were dropped on the bare site root,
// which gave no feedback that the confirmation had actually worked.
//
// One dynamic route serves all three flows because the DOI *redirect* is a per-call Brevo field,
// not a template setting — so the flows share one template and still land somewhere specific.
//
// Dynamic (no build prerender) so the (public) layout reads the analytics env at REQUEST time.
// Matches every other public page.
export const revalidate = 0;

interface FlowCopy {
  /** Page + document title. */
  title: string;
  /** What they just signed up for, and what actually happens next. */
  body: string;
  /** Primary next step — somewhere useful, not a dead end. */
  cta: { href: string; label: string };
}

const FLOW_COPY: Record<SubscriptionFlow, FlowCopy> = {
  digest: {
    title: 'You’re subscribed',
    body: 'Your email is confirmed. Your first Weekly Digest — newly added and closing-soon competitions, hand-picked by our curators — is on its way. You can unsubscribe from any email we send.',
    cta: { href: '/competitions', label: 'Browse competitions' },
  },
  follow: {
    title: 'You’re following',
    body: 'Your email is confirmed. We’ll email you when this competition’s dates are announced or updated. You can unsubscribe from any email we send.',
    cta: { href: '/competitions', label: 'Find more competitions' },
  },
  hosts: {
    title: 'You’re on the list',
    body: 'Your email is confirmed. We’ll email you when host tools open up — claiming your listing, managing editions, and reaching the families already searching for what you run.',
    cta: { href: '/how-it-works', label: 'How BeeCompete works' },
  },
};

interface PageProps {
  params: Promise<{ flow: string }>;
}

const NOT_FOUND_SEO = {
  title: 'Not found',
  description: 'Page not found.',
  path: '/subscribed',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { flow } = await params;
  if (!isSubscriptionFlow(flow)) return pageMetadata({ ...NOT_FOUND_SEO, noindex: true });
  return pageMetadata({
    title: FLOW_COPY[flow].title,
    description: 'Your email subscription is confirmed.',
    path: `/subscribed/${flow}`,
    // Always noindex, independent of the global SEARCH_INDEXING flag: this is a private
    // transactional endpoint reached only from a link in someone's inbox. Indexing it would leak
    // confirmation pages into search results for no benefit.
    noindex: true,
  });
}

export default async function SubscribedPage({ params }: PageProps) {
  const { flow } = await params;
  // Unknown slug → 404 rather than a generic "you're subscribed" that might be a lie. Only reachable
  // by hand-editing the URL; every real confirmation link carries a known flow.
  if (!isSubscriptionFlow(flow)) notFound();

  const copy = FLOW_COPY[flow];

  return (
    <div className="mx-auto max-w-xl py-8 text-center sm:py-16">
      <CheckCircle
        aria-hidden="true"
        weight="duotone"
        className="mx-auto size-14 text-brand-gold"
      />
      <h1 className="mt-5 font-display text-3xl text-foreground sm:text-4xl">{copy.title}</h1>
      <p className="mt-4 text-muted">{copy.body}</p>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href={copy.cta.href} className={cn(buttonClasses({ variant: 'primary' }))}>
          {copy.cta.label}
        </Link>
        <Link href="/" className={cn(buttonClasses({ variant: 'ghost' }))}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
