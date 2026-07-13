'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, buttonClasses, cn } from '@beecompete/ui';

// Mobile sticky bottom bar (blueprints Page 3, owner 2026-07-08): a slim Follow + Register
// bar that appears once the header scrolls out of view. Desktop keeps the sticky sidebar
// instead, so this is hidden at lg+. Observes a sentinel placed right after the header.

interface StickyBottomBarProps {
  sentinelId: string;
  registerUrl: string | null;
}

export function StickyBottomBar({ sentinelId, registerUrl }: StickyBottomBarProps) {
  const [show, setShow] = useState(false);

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
        <a
          href="#follow-cta"
          className={cn(buttonClasses({ variant: 'secondary' }), 'flex-1 justify-center')}
        >
          Follow
        </a>
        {registerUrl && (
          <a
            href={registerUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonClasses({ variant: 'brand' }), 'flex-1 justify-center')}
          >
            Register
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        )}
      </div>
    </div>
  );
}
