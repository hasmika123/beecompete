import type { ComponentType, ReactNode } from 'react';
import { cn } from '@beecompete/ui';

// THE detail page's field register (owner 2026-08-27, #112). Every tab except FAQ renders its
// fields through this: icon · label column · value, hairline between rows. One component so the
// tabs cannot drift into five dialects of the same list — it replaces DefinitionGrid, whose
// right-aligned two-up cells could hold neither a paragraph nor a URL.
//
// COLUMNS (owner): a field whose value is reliably SHORT — cost, delivery, scope, runs, format —
// may pair two-to-a-row; everything else spans the full width. Callers mark `compact` per field,
// never by measuring the string: a length heuristic makes the same field jump between one and two
// columns on different listings, which reads as a layout bug rather than a decision.
//
// HOLES ARE HANDLED HERE, NOT BY THE CALLER (#113). A full-width row landing after an ODD number
// of compact ones would leave a gap beside the last compact one, so the ledger stretches that odd
// item across both columns to close the row — but only when something follows it. A compact field
// that simply ends the list keeps its half width, since there is no hole to close and stretching
// one short value across the full width just looks empty.
// This is why callers may order fields however reads best; an earlier revision made them keep
// odd runs at the end, which is a constraint the layout should absorb, not the content.
// (`grid-auto-flow: dense` would also fill the gap — by reordering, which breaks reading and tab
// order. Not that.)
//
// Icons are optional and all-or-nothing per list. The More tab omits them: its fields are
// arbitrary Category Template keys, so any glyph would be decoration standing in for meaning, and
// repeating one neutral icon down every row is worse than none.

export type LedgerIcon = ComponentType<{
  className?: string;
  weight?: 'regular' | 'bold' | 'fill' | 'duotone';
}>;

export interface LedgerItem {
  /** Stable key — labels are not unique once a tab repeats a field kind (awards). */
  key: string;
  icon?: LedgerIcon;
  label: string;
  value: ReactNode;
  /** Subordinate line under the value — a qualifier, not the value itself. */
  note?: ReactNode;
  /** Reliably short: may share a row with an adjacent compact field. */
  compact?: boolean;
}

/**
 * `labelWidth` widens the label column for tabs whose LABEL is the content — Awards, where the
 * label is an award's name ("Grand prize — national finals") rather than a field name, and the
 * value is a short amount. The default suits field names, which are one or two words.
 */
export function DetailLedger({
  items,
  labelWidth = 'default',
}: {
  items: LedgerItem[];
  labelWidth?: 'default' | 'wide';
}) {
  if (items.length === 0) return null;
  const hasIcons = items.some((i) => i.icon);
  const lastIndex = items.length - 1;
  // Which items sit in the final VISUAL row differs by breakpoint: one column below sm (only the
  // last item), two columns above it. Hence the split between `border-b-0` and `sm:border-b-0` —
  // dropping the hairline under one half of a pair while the other keeps it is the asymmetry
  // this avoids.
  //
  // ⚠ The last item shares its row ONLY when the trailing run of compact items has EVEN length.
  // An odd run leaves the final item alone in its own row, so the one before it is still a full
  // row up and MUST keep its hairline. (Logistics has five trailing compacts — pairs, then a
  // lone Format — and an earlier version of this that just checked `items[lastIndex - 1]`
  // stripped the border under "Runs" while "Scope" beside it kept one.)
  let trailingCompact = 0;
  for (let i = lastIndex; i >= 0 && items[i]!.compact; i--) trailingCompact++;
  const pairedWithLast = trailingCompact >= 2 && trailingCompact % 2 === 0;

  // A compact item spans both columns when it is the odd one out of its run AND something
  // follows it — see the note above. Computed per index so the JSX stays declarative.
  const spansFull = (item: LedgerItem, i: number): boolean => {
    if (!item.compact) return true;
    if (i === lastIndex) return false;
    if (items[i + 1]?.compact) return false; // not the end of its run
    let runLength = 0;
    for (let j = i; j >= 0 && items[j]!.compact; j--) runLength++;
    return runLength % 2 === 1;
  };

  return (
    <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
      {items.map((item, i) => {
        const Icon = item.icon;
        const isLast = i === lastIndex;
        const isLastRowAtSm = isLast || (pairedWithLast && i === lastIndex - 1);
        return (
          <div
            key={item.key}
            className={cn(
              'flex items-baseline gap-3 border-b border-border/60 py-2.5',
              spansFull(item, i) && 'sm:col-span-2',
              isLast && 'border-b-0',
              isLastRowAtSm && 'sm:border-b-0',
            )}
          >
            {hasIcons &&
              (Icon ? (
                <Icon
                  aria-hidden="true"
                  weight="duotone"
                  className="size-4 shrink-0 translate-y-0.5 text-muted"
                />
              ) : (
                // Keeps the label column aligned if one item in an icon-bearing list has no glyph.
                <span aria-hidden="true" className="size-4 shrink-0" />
              ))}
            <dt
              className={cn(
                'shrink-0 text-sm text-muted',
                labelWidth === 'wide' ? 'w-32 sm:w-52' : 'w-24 sm:w-28',
              )}
            >
              {item.label}
            </dt>
            <dd className="min-w-0 flex-1 text-sm leading-relaxed font-medium text-foreground">
              {item.value}
              {item.note && (
                <span className="mt-0.5 block text-xs leading-normal font-normal text-muted">
                  {item.note}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
