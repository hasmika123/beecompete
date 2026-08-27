'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@beecompete/ui';

/**
 * Announces the public URL a newly created listing was assigned.
 *
 * The slug is derived from the name and never shown in the create form, so without this the
 * curator would never learn what URL their listing got — least of all when the server had to
 * suffix it (`-2`) because that URL was already taken, which is otherwise entirely silent.
 *
 * Lives here rather than in the form because `createCompetition` REDIRECTS on success: the form
 * unmounts, so a toast fired there would never be seen. The action passes the assigned slug on
 * the query string and this fires once on arrival, then strips the params so a refresh (or a
 * back-navigation) doesn't re-announce a creation that already happened.
 */
export function CreatedToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const announced = useRef(false);

  const slug = params.get('created');
  const adjusted = params.get('urlAdjusted') === '1';
  const extrasFailed = Number(params.get('extrasFailed') ?? 0);

  useEffect(() => {
    if (!slug || announced.current) return;
    announced.current = true; // StrictMode double-invokes effects in dev — toast exactly once.
    toast({
      title: adjusted ? 'Created — URL adjusted' : 'Competition created',
      description: adjusted
        ? `That URL was already taken, so this listing is at /c/${slug}`
        : `Public URL: /c/${slug}`,
      tone: 'success',
      // A URL is something you read, not glance at — and the adjusted case is the one message
      // that reports a decision the curator had no part in, so it gets longer still.
      duration: adjusted ? 12000 : 8000,
    });
    // The create succeeded but some resources/FAQ rows didn't post (they're follow-up calls —
    // see createCompetition). Named HERE because the failure is otherwise invisible: the
    // listing looks fine, it's just missing rows the curator typed. This page's managers are
    // the retry path, so the message points at them.
    if (extrasFailed > 0) {
      toast({
        title: 'Some extras didn’t save',
        description: `${extrasFailed} resource/FAQ ${extrasFailed === 1 ? 'entry' : 'entries'} failed to save — re-add ${extrasFailed === 1 ? 'it' : 'them'} in the sections below.`,
        tone: 'error',
        duration: 12000,
      });
    }
    router.replace(pathname, { scroll: false });
  }, [slug, adjusted, extrasFailed, toast, router, pathname]);

  return null;
}
