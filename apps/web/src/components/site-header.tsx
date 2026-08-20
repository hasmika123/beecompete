'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge, ListIcon, Logo, ThemeToggle, Tooltip, X, cn } from '@beecompete/ui';

// Blueprint NavBar (shared component): logo + Beta tag left; Competitions · Categories ·
// Articles center (#66 — replaces How It Works, which was discarded); the Sign In/Up slot is
// reserved for R2 (hidden at R1 — no accounts).
// Sticky with a subtle shadow once scrolled. "For Educators" joins when that page ships.
// The "Beta" tag is R1-13's persistent disclaimer surface — a tooltip explains what beta means
// (the app-wide disclaimer proper lives in the footer, per the owner's R1-13 decision).
const NAV = [
  { href: '/competitions', label: 'Competitions' },
  { href: '/categories', label: 'Categories' },
  { href: '/articles', label: 'Articles' },
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
      {/* Full-width bar, NOT max-w-6xl (#52). Shrinking the padding alone could never move the
          nav outward on a desktop: at ≥1152px the max-width's auto side margins set the inset
          (72px at 1280) and the padding was a rounding error on top of it — so the change only
          ever showed on phones, where it squeezed the logo to an 8px edge. Dropping the max-width
          is what actually makes "less edge padding" mean something at every size: the inset is now
          the padding, full stop — 16px on phones and 32px from sm up (#53 gave some back after
          24px read as too tight; still well inside the 72px the max-width used to force at 1280).
          The bar deliberately no longer aligns with the body's content column.
          The logo can no longer be squeezed (packages/ui Logo is `shrink-0` since the mobile
          pass), so the left group now claims its full intrinsic width — 164px at the desktop
          height. Two things pay for that on a 320px phone, where the budget is 288px against a
          76px right group: the column gap drops to 8px below sm, and the wordmark steps down to
          24px (131px wide). 131 + 10 + the Beta badge fits 320 with room to spare, and both revert
          to the desktop values at sm. Neither touches the BAR height, so the hero coupling below
          is unaffected.
          ⚠ h-14 (#50, was h-16) is a COUPLED value: the landing hero's `--hero-available` subtracts
          this header, so the two must be changed together or the hero stops ending exactly at the
          fold. The pair is currently h-14 ↔ `calc(100svh-4rem-1px)` (56px bar + 1px border + 8px
          of clearance). Grep `--hero-available` before touching this. */}
      {/* max-w-[1600px] (#69) stops the bar spreading forever on a monitor. Full-width was right
          for laptops — it is what made "less edge padding" mean anything at all (see above) — but
          past ~1600px it pinned the logo and the theme toggle to opposite extremes of a 2560px
          screen, ~2500px apart and nowhere near the content below. The cap only engages above
          1600px, so every size that motivated the full-width change is untouched. */}
      <div className="mx-auto grid h-14 w-full max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:gap-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            aria-label="BeeCompete home"
            className="flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Logo className="h-6 sm:h-[1.875rem]" />
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
                  'rounded-full px-3.5 py-1.5 text-[0.9375rem] font-medium transition-colors',
                  // Inactive links were `text-muted`, darkened toward the ink over #49–#50 to the
                  // owner's "charcoal". foreground/95 rather than a literal charcoal hex so it
                  // stays theme-aware: a near-ink charcoal in light mode, and its correct analogue
                  // in dark, where a literally darker gray would REDUCE contrast, not deepen it.
                  active
                    ? 'bg-surface text-foreground'
                    : 'text-foreground/95 hover:bg-surface/60 hover:text-foreground',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* col-start-3 is required, not decorative (#52). The centre nav is `hidden` below sm,
            and a display:none child is removed from grid layout altogether — so auto-placement
            dropped this group into the MIDDLE track and left the third one empty, parking the
            theme toggle and menu button around x=157 on a 390px phone instead of against the
            right edge. Pinning the column fixes it whether or not the nav is rendered. */}
        <div className="col-start-3 flex items-center justify-self-end gap-1">
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
