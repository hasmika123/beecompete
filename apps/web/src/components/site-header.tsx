'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge, ListIcon, Logo, ThemeToggle, Tooltip, X, cn } from '@beecompete/ui';

// Blueprint NavBar (shared component): logo + Beta tag left; Competitions · Categories ·
// How It Works center; the Sign In/Up slot is reserved for R2 (hidden at R1 — no accounts).
// Sticky with a subtle shadow once scrolled. "For Educators" joins when that page ships.
// The "Beta" tag is R1-13's persistent disclaimer surface — a tooltip explains what beta means
// (the app-wide disclaimer proper lives in the footer, per the owner's R1-13 decision).
const NAV = [
  { href: '/competitions', label: 'Competitions' },
  { href: '/categories', label: 'Categories' },
  { href: '/how-it-works', label: 'How It Works' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape closes the mobile menu and returns focus to its toggle (parity with the ShareMenu
  // popover; keyboard users need a way out that isn't tabbing to a link).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur transition-shadow',
        scrolled && 'shadow-[var(--shadow-lift)]',
      )}
    >
      {/* 3-column grid (1fr auto 1fr) so the center nav is centered on the header itself, not
          just wedged between the left/right groups. On mobile the nav column is empty (nav is
          hidden) and the two 1fr tracks split — logo left, menu button right. */}
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            aria-label="BeeCompete home"
            className="flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Logo className="h-8" />
          </Link>
          {/* Beta tag + tooltip disclaimer (R1-13). Badge is made focusable (tabIndex) so the
              tooltip is reachable by keyboard/AT, not just hover. */}
          <Tooltip content="BeeCompete is in beta: the catalog is still growing and listing details can change. Always confirm on the organizer's official site.">
            <Badge variant="gold" tabIndex={0} className="cursor-help">
              Beta
            </Badge>
          </Tooltip>
        </div>

        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-surface text-foreground'
                    : 'text-muted hover:bg-surface/60 hover:text-foreground',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-self-end gap-1">
          {/* Sign In / Sign Up slot reserved — hidden until accounts exist (R2). */}
          <ThemeToggle />
          <button
            ref={toggleRef}
            type="button"
            className="rounded-full p-2 text-muted hover:bg-surface hover:text-foreground sm:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <ListIcon aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-border px-4 py-2 sm:hidden"
        >
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface',
                  active ? 'bg-surface text-foreground' : 'text-foreground',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
