'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, GraduationCap, Medal, Users } from '@beecompete/ui';
import { HostBand } from './host-band';
import { DigestBand } from '@/components/digest-band/digest-band';

type Panel = 'digest' | 'host';

// H46 audience cards. Each card OPENS a capture panel in place (#57) instead of linking to an
// always-visible band further down the page — two of them lead to the weekly digest, the
// organizers card to host early access.
const AUDIENCES: {
  title: string;
  copy: string;
  cta: string;
  panel: Panel;
  icon: typeof Users;
}[] = [
  {
    title: 'For Students & Parents',
    copy: 'Find competitions that fit, by grade, budget, and what you’re into.',
    cta: 'Get the weekly digest',
    panel: 'digest',
    icon: Users,
  },
  {
    title: 'For Educators',
    copy: 'Point your students and clubs at vetted, current opportunities.',
    cta: 'Get the weekly digest',
    panel: 'digest',
    icon: GraduationCap,
  },
  {
    title: 'For Organizers',
    copy: 'Reach the families searching for exactly what you run.',
    cta: 'Get early access',
    panel: 'host',
    icon: Medal,
  },
];

export function AudienceSection() {
  const [open, setOpen] = useState<Panel | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Which card opened the panel, so focus can be returned there on close (WCAG 2.4.3) rather than
  // dumped at the top of the document when the panel unmounts.
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => {
    setOpen(null);
    triggerRef.current?.focus();
  }, []);

  // /#digest still has to work. How It Works links to it, and before #57 it landed on a band that
  // was always in the DOM; now the panel does not exist until something opens it, so the hash has
  // to open it explicitly. `hashchange` covers clicking such a link while already on this page,
  // where there is no remount to hang the initial check on.
  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === '#digest') setOpen('digest');
      if (window.location.hash === '#host-access') setOpen('host');
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  // Move focus into the panel once it exists. Without this a keyboard or screen-reader user
  // activates a card and is left sitting on it while the new content appears below, unannounced.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.focus({ preventScroll: true });
    panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [open]);

  // Escape closes, mirroring the header's mobile menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    // Cards + panel are wrapped as ONE page-grid child on purpose. As a bare fragment they became
    // two separate children of the landing grid and inherited its full section gap (80px), which
    // read as an unrelated band floating below. The panel is disclosed BY a card, so it belongs
    // visually attached to them — gap-6 here, not the page rhythm.
    <div className="grid gap-6">
      <section aria-labelledby="audience-heading" className="grid gap-5">
        <h2 id="audience-heading" className="font-display text-2xl text-foreground sm:text-3xl">
          Get the weekly competition digest
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {AUDIENCES.map(({ title, copy, cta, panel, icon: Icon }) => (
            <button
              key={title}
              type="button"
              // aria-expanded/controls tell AT this is a disclosure, not navigation — the visual
              // arrow reads like a link, so the semantics have to say otherwise.
              aria-expanded={open === panel}
              aria-controls={panel === 'digest' ? 'digest' : 'host-access'}
              onClick={(e) => {
                triggerRef.current = e.currentTarget;
                setOpen(panel);
              }}
              className="group block rounded-[var(--radius-panel)] border border-border bg-surface-raised p-6 text-left transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Icon aria-hidden="true" weight="duotone" className="size-8 text-brand-gold" />
              <h3 className="mt-3 font-display text-xl text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted">{copy}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                {cta} <ArrowRight aria-hidden="true" className="size-4" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {open && (
        <div ref={panelRef} tabIndex={-1} className="animate-rise-in focus-visible:outline-none">
          {open === 'digest' ? <DigestBand onClose={close} /> : <HostBand onClose={close} />}
        </div>
      )}
    </div>
  );
}
