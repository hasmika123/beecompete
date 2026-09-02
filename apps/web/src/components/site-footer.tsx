import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Logo, XLogo, Youtube, cn } from '@beecompete/ui';
import { LEGAL_PAGES } from '@/lib/legal';

// Blueprint footer (shared component). Contribute + Legal nav columns. The brand column
// carries the app-wide beta disclaimer (R1-13): product is beta · details can change (confirm on
// the organizer's official site) · BeeCompete is independent and not affiliated with the listed
// organizers (compliance §8, nominative use). The header "Beta" badge + tooltip is the other R1-13
// surface. Legal links (Privacy · Terms · Cookie Policy · Affiliate Disclosure) land here with
// R1-12, sourced from the single LEGAL_PAGES list so the footer and each policy page's cross-links
// never drift.
// The Explore column (Competitions · Categories · Articles) was removed 2026-08-19 (owner). It is
// the one group the footer blueprint marks as droppable — Legal is mandated on every page
// (compliance §DQ10) and Contribute is the only route into the correction/request queues, whereas
// all three Explore destinations are in the header nav on every page, so nothing left the site's
// link graph.

// Title Case, consistent with the Legal links.
const CONTRIBUTE = [
  { href: '/suggest-a-competition', label: 'Request a Competition' },
  { href: '/suggest-a-correction', label: 'Suggest a Correction' },
  { href: '/feedback', label: 'Send Feedback' },
];

const COLUMNS = [
  { label: 'Contribute', links: CONTRIBUTE },
  { label: 'Legal', links: LEGAL_PAGES },
];

/**
 * Footer body text (#63) — the same `foreground/95` charcoal the NavBar links use, replacing the
 * old `text-muted` throughout: links, the disclaimer, and the copyright line.
 *
 * Applied to the fine print too, deliberately. That copy is the R1-13 beta + independence
 * disclaimer and the FTC affiliate note — the text most worth being able to read, so the lighter
 * grey was never the right call there. Kept as a `foreground` alpha, not a charcoal hex, so it
 * stays theme-aware: hard-coding a darker grey would REDUCE contrast in dark mode, not deepen it.
 */
const FOOTER_TEXT = 'text-foreground/95';

// Social icons replace the bottom bar's policy links (#61), closing the "social links" gap the
// footer blueprint has specced since R1-12.
//
// ⚠ Safe ONLY because the bottom bar duplicated links that also live in the Legal column: all four
// LEGAL_PAGES (Privacy · Terms · Cookie Policy · Affiliate Disclosure) are still rendered there, so
// nothing compliance-mandated left the footer. Do not extend this by trimming the Legal column —
// those four are required on every public page (docs/compliance.md).
//
// `href: null` = not linked yet (owner: "we'll link them later"). Until a URL exists each icon
// renders as inert, aria-hidden decoration rather than a dead <a href="#">: announcing "Instagram,
// link" to a screen-reader user for something that navigates nowhere is worse than staying silent.
// Adding the URL is the only change needed — the render branch already handles the linked case.
const SOCIALS: { label: string; href: string | null; icon: typeof Instagram }[] = [
  { label: 'Instagram', href: null, icon: Instagram },
  { label: 'X', href: null, icon: XLogo },
  { label: 'YouTube', href: null, icon: Youtube },
  { label: 'Facebook', href: null, icon: Facebook },
  { label: 'LinkedIn', href: null, icon: Linkedin },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      {/* py-6 (#62, was py-10) — vertical only; the horizontal px-4/sm:px-6 still aligns the
          footer with the body's content column and is deliberately untouched. */}
      {/* ONE grid for all four columns (#63), not brand + a nested 3-col block. Nested, the brand
          track was 1.5fr (~446px) while its content was capped at max-w-sm (384px), so the leftover
          62px of track added to the 64px gap and left a 126px hole before "Explore" against 32px
          between the nav columns. Flattening lets a single `gap-8` govern every boundary, and
          pinning the brand track to the same 26rem as its content is what stops the hole coming
          back. The nav columns were always equal to each other — the unevenness was entirely here.
          26rem also fixes the "site." orphan: the disclaimer needs 392px to fall in two lines and
          had 384px, so this is the smallest step that clears it with margin to spare. */}
      {/* Two-up nav columns below lg (mobile pass). Fully stacked, the footer ran 731px on a
          375px screen — a whole viewport of chrome under every page. With Explore gone there are
          exactly two navs, so `grid-cols-2` now seats them side by side on ONE row at every width
          below lg and the old `sm:grid-cols-3` is dropped: at three tracks the pair would leave a
          visible empty third cell. The brand column spans the full row below lg, as before. */}
      {/* At lg this is TWO tracks — brand, then one track holding both navs — not three (owner
          2026-09-02). The eye reads the gaps between the ink, not the track edges, and the nav
          text is far narrower than its track, so equal `fr` tracks left all the slack on each
          column's right: gaps of 46 / 194 / 188px, with "Contribute" hard against the end of the
          beta disclaimer. Sizing the tracks to content and pushing them apart with
          `justify-between` fixed that boundary but pinned "Legal" flush to the right edge
          (221 / 207 / 0), which just moved the crowding to the other end.
          Both navs now share ONE track and divide it with `space-evenly`, which is the only rule
          that makes the space BEFORE, BETWEEN and AFTER them equal — the three gaps the eye
          actually compares. `lg:gap-x-0` on the outer grid is load-bearing: any column gap there
          would be added to the first of those three gaps only, tilting the set it exists to even
          out. Equal by construction at any width and whatever the labels later say, so there is
          nothing here to re-tune.
          The brand track stays pinned to 26rem for the reason below; its own 402px of ink inside
          that 416px track is the one asymmetry left, and it is smaller than the raggedness of the
          wrapped disclaimer beside it. */}
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-7 px-4 py-6 sm:gap-8 sm:px-6 lg:grid-cols-[26rem_1fr] lg:gap-x-0">
        <div className="col-span-2 max-w-[26rem] text-sm lg:col-span-1">
          <Logo />
          {/* The marketing tagline that sat here was removed (#61). The disclaimer below is
              compliance copy (R1-13), not a replacement for it — do not trim that one to match. */}
          {/* Split into two paragraphs (#62) — the beta caveat and the independence disclaimer are
              two distinct claims and ran together as one block. The WORDING is unchanged: this is
              R1-13 compliance copy (docs/compliance.md §8, nominative use), so it may be re-laid
              out but not reworded or shortened. */}
          <p className={cn('mt-3 text-xs', FOOTER_TEXT)}>
            {/* Literal ’ (not &apos;) — an HTML entity anywhere in this text block makes SWC
                drop the space after the inline element ("beta— the"). */}
            BeeCompete is in <strong className="font-medium text-foreground">beta</strong>. The
            catalog is growing and details can change, so always confirm the details on the
            organizer’s official site.
          </p>
          <p className={cn('mt-2 text-xs', FOOTER_TEXT)}>
            We’re an independent catalog and aren’t affiliated with or endorsed by the competitions
            and organizers listed here.
          </p>
        </div>
        {/* Below lg this wrapper is transparent to the old layout — it spans the full row and
            re-creates the same two equal columns the outer grid used to give the navs directly.
            It only becomes a distributor at lg, where it owns the whole non-brand track. */}
        <div className="col-span-2 grid grid-cols-2 gap-x-6 sm:gap-x-8 lg:col-span-1 lg:flex lg:justify-evenly lg:gap-x-0">
          {/* Headings are bold sentence case (#63), not uppercase+tracked. Dropping the caps costs
              the label its size cue, so they step 12 → 14px to stay distinct from the links. */}
          {COLUMNS.map(({ label, links }) => (
            <nav key={label} aria-label={label} className="text-sm">
              <h2 className="mb-3 text-sm font-bold text-foreground">{label}</h2>
              <ul className="grid gap-2">
                {links.map(({ href, label: linkLabel }) => (
                  <li key={href}>
                    <Link href={href} className={cn(FOOTER_TEXT, 'hover:text-foreground')}>
                      {linkLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        {/* py-3 (#62, was py-4) — a smaller trim than the section above, per the owner. The bar is
            already short, so it has far less to give before the 36px social buttons set the height
            floor anyway. */}
        <div
          className={cn(
            'mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6',
            FOOTER_TEXT,
          )}
        >
          <p>
            © {new Date().getFullYear()} BeeCompete. Some resource links may be affiliate links.
            They never affect what we list.
          </p>
          {/* Bordered circles rather than bare glyphs (#62): loose icons on a plain ground read as
              stray marks next to the copyright line, and the ring is what makes them a deliberate
              set. Shape follows the design brief's pill/rounded rule and takes its colour from
              tokens, so it tracks both themes with no per-theme override. */}
          <ul className="flex flex-wrap items-center gap-2">
            {SOCIALS.map(({ label, href, icon: Icon }) => {
              // Resting style is shared so the row looks identical before and after the URLs land;
              // only the interactive affordances are added on the linked branch.
              const base = cn(
                'grid size-9 place-items-center rounded-full border border-border bg-surface',
                FOOTER_TEXT,
              );
              return (
                <li key={label}>
                  {href ? (
                    <Link
                      href={href}
                      aria-label={label}
                      className={cn(
                        base,
                        'transition-colors hover:border-foreground/30 hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      )}
                    >
                      <Icon aria-hidden="true" weight="fill" className="size-[17px]" />
                    </Link>
                  ) : (
                    <span className={base}>
                      <Icon aria-hidden="true" weight="fill" className="size-[17px]" />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </footer>
  );
}
