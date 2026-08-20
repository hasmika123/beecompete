'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, categoryArt, cn } from '@beecompete/ui';

/**
 * "By category" tile grid with a two-row cap (owner 2026-08-18, #108): rather than spilling onto
 * a third row, the grid stops after row 2 and spends that row's LAST CELL on a "Show more" tile;
 * pressing it reveals the rest.
 *
 * ⚠ The overflow tiles are hidden with CSS, never sliced out of the array. Every category link
 * must stay in the HTML — this page exists to be "every browse angle as a crawlable entry point"
 * (blueprints Page 5), and crawlers do not press buttons.
 *
 * The cutoff is therefore also CSS, because the column count is responsive (1 / 3 / 4) and so is
 * "the last cell of the final row". Hidden tiles are `display:none`, so they leave the grid flow
 * entirely and the toggle (always the last child) lands in that final slot on its own.
 *
 * ⚠ The base column count is **1** since 2026-08-19 (owner: one category per row on a phone, each
 * tile wider than it is tall). That breaks the old "(columns × 2) − 1" identity the sm/lg counts
 * still follow: at one column it would keep a single tile, so 11 categories would preview as one.
 * The base count is therefore chosen for its own reason — 4 tiles is a preview that reads as a
 * list without becoming an 11-row wall — and is NOT derivable from the column count. Keep
 * KEEP_BASE and the `max-sm:` nth-child rule in step by hand.
 */

export interface CategoryTile {
  slug: string;
  name: string;
  oneLiner: string;
  count: number;
}

// Tiles kept visible while collapsed, per breakpoint. sm/lg are (columns × 2) − 1, leaving the
// last cell of row 2 for the toggle; base is a flat 4 because one-per-row has no "row 2" worth
// capping to (see the note above). Keep in step with the grid-cols + nth-child rules below.
const KEEP_BASE = 4; // grid-cols-1
const KEEP_SM = 5; // sm:grid-cols-3
const KEEP_LG = 7; // lg:grid-cols-4

export function CategoryGrid({ categories }: { categories: CategoryTile[] }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  // Only worth a toggle where something would actually be hidden at that width; below the base
  // threshold the grid already fits two rows everywhere.
  const needsToggle = categories.length > KEEP_BASE;

  return (
    <ul
      id={listId}
      className={cn(
        'mt-5 grid list-none grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4',
        !expanded && [
          // One hide rule per column-count zone, in MUTUALLY EXCLUSIVE media ranges that mirror
          // the grid-cols breakpoints — so exactly one ever applies and there is no cascade
          // fight. ⚠ Do NOT rewrite this as "hide everything, then un-hide at sm/lg": Tailwind
          // emits `hidden` after `block`, so at equal specificity the hide wins at every width
          // and the grid silently stays at 3 tiles (measured — this was the first attempt).
          // :not(:last-child) exempts the toggle, which is always the last child.
          'max-sm:[&>li:nth-child(n+5):not(:last-child)]:hidden', // 1 col → keep 4
          'sm:max-lg:[&>li:nth-child(n+6):not(:last-child)]:hidden', // 3 cols → keep 5
          'lg:[&>li:nth-child(n+8):not(:last-child)]:hidden', // 4 cols → keep 7
        ],
      )}
    >
      {categories.map((category) => {
        const art = categoryArt(category.slug);
        const Icon = art.icon;
        return (
          <li key={category.slug}>
            <Link
              href={`/competitions/${category.slug}`}
              // Landscape row on phones (icon left, text right), the original portrait card from
              // sm. One category per row only reads as a tile if the box is wider than it is tall —
              // a full-width portrait card would be a 217px-tall slab per category.
              className="group flex h-full items-center gap-3 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-4 transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:flex-col sm:items-start sm:gap-2 sm:p-5"
            >
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br',
                  art.cover,
                )}
              >
                <Icon aria-hidden="true" weight="duotone" className={cn('size-5', art.coverIcon)} />
              </span>
              {/* `sm:contents` dissolves this wrapper at sm, handing the name and meta straight
                  back to the card's own column flex — so the portrait layout is unchanged rather
                  than re-implemented inside a nested box. */}
              <span className="flex min-w-0 flex-col gap-0.5 sm:contents">
                <span className="font-display text-lg text-foreground">{category.name}</span>
                <span className="text-xs text-muted">
                  {category.count} listed · {category.oneLiner}
                </span>
              </span>
            </Link>
          </li>
        );
      })}

      {needsToggle && (
        <li
          className={cn(
            // Where the grid ALREADY fits in two rows at a given width, the toggle would be a
            // button that hides nothing — drop it at that breakpoint instead.
            categories.length <= KEEP_SM && 'sm:hidden',
            categories.length <= KEEP_LG && 'lg:hidden',
          )}
        >
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={listId}
            // Mirrors the category tile at both shapes — left-aligned landscape row on phones,
            // centred portrait card from sm — so the toggle reads as the last cell of the same
            // grid rather than a differently-shaped control.
            className="group flex h-full w-full items-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border bg-surface p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-foreground/30 sm:flex-col sm:justify-center sm:p-5 sm:text-center"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-raised">
              <ChevronDown
                aria-hidden="true"
                className={cn('size-5 text-muted transition-transform', expanded && 'rotate-180')}
              />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 sm:contents">
              <span className="font-display text-lg text-foreground">
                {expanded ? 'Show less' : 'Show more'}
              </span>
              {!expanded && (
                <span className="text-xs text-muted">{categories.length} categories in total</span>
              )}
            </span>
          </button>
        </li>
      )}
    </ul>
  );
}
