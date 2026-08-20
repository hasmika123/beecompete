'use client';

import { useEffect, useState } from 'react';
import { Bell, ExternalLink, ShareMenu, buttonClasses, cn } from '@beecompete/ui';
import { useFollowOpener } from '@/components/detail/follow-disclosure';

// Mobile sticky bottom bar (blueprints Page 3, owner 2026-07-08): a slim bar that appears once
// its sentinel scrolls out of view. Desktop keeps the sticky sidebar instead, so this is hidden
// at lg+. The sentinel sits at the END of the cover/Register card, so the bar takes over exactly
// when the real Register CTA leaves the screen.
//
// Layout (owner 2026-08-19): Register is the bar — it takes all the width there is — and Follow
// and Share ride along as grey icon circles on the right, the same pair as the breadcrumb row.
// Before this it was Follow and Register as equal halves, which gave the page's one conversion
// action half a bar and spelled out a label the icon says just as well at this size.

interface StickyBottomBarProps {
  sentinelId: string;
  registerUrl: string | null;
  /** For the Share trigger — same values the page's breadcrumb-row ShareMenu gets. */
  competitionName: string;
  path: string;
}

export function StickyBottomBar({
  sentinelId,
  registerUrl,
  competitionName,
  path,
}: StickyBottomBarProps) {
  const [show, setShow] = useState(false);
  // The follow panel is a disclosure now (owner 2026-08-18), so this opens it rather than
  // jumping to an always-present anchor; the panel's input autofocuses, which carries the
  // viewport there.
  const openFollow = useFollowOpener();

  useEffect(() => {
    const sentinel = document.getElementById(sentinelId);
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShow(!!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelId]);

  return (
    <div
      // inert while hidden — the slide-out is transform-only, so without it the invisible
      // Follow/Register links stay in the keyboard tab order (review fix M5).
      inert={!show}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden',
        'transition-transform duration-200',
        show ? 'translate-y-0' : 'translate-y-full',
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        {registerUrl && (
          <a
            href={registerUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonClasses({ variant: 'brand' }), 'min-w-0 flex-1 justify-center')}
          >
            Register
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        )}
        {/* `ml-auto` is only load-bearing in the no-registration-link branch (closed edition, or a
            listing with no URL yet): with Register present its flex-1 has already claimed the
            slack, so this is a no-op. Without it the two circles would sit orphaned at the left
            edge of an otherwise empty bar. */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={openFollow}
            aria-controls="follow-cta"
            aria-label="Follow this competition"
            className={cn(buttonClasses({ variant: 'secondary' }), 'size-9 rounded-full px-0')}
          >
            <Bell aria-hidden="true" className="size-4" />
          </button>
          <ShareMenu title={competitionName} path={path} variant="icon-secondary" />
        </div>
      </div>
    </div>
  );
}
