import type { ComponentType } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Clock,
  Globe,
  GraduationCap,
  MapPin,
  Restore,
  Ticket,
  Trophy,
  Users,
  categoryArt,
  cn,
} from '@beecompete/ui';
import { gradeLabel } from '@/lib/catalog-display';
import { formatDate } from '@/lib/dates';
import {
  costLabel,
  currentEdition,
  deadlineFact,
  deliveryLabel,
  locationLabel,
  nextDeadline,
  participationLabel,
  prizeLabel,
  recurrenceLabel,
  regOpensAt,
} from '@/lib/detail-display';
import type { CompetitionDetail } from '@/lib/catalog-types';

// "At a glance" strip (blueprints Page 3.2; regrouped #82, reordered #105): the 10-second
// answer — icons + values in the SAME fixed order on every competition, sequenced as the
// question a parent actually works through:
//
//   1. WHAT IS IT   Category                       — is this our subject?
//   2. WHO          Grades · Format                — can my kid enter, alone or on a team?
//   3. WHEN         Status · Next deadline         — can we still enter, and by when?
//   4. WHAT IT COSTS  Cost
//   5. HOW / WHERE  Delivery · Location            — do we travel, and how far?
//   6. PAYOFF       Prize
//
// Each group is contiguous so related facts read together (the old order split Status from the
// deadline, and Location from Delivery). At the sm+ 3-column width the groups also land as whole
// rows — identity+eligibility / timing+cost / logistics+payoff — when every field is present.
// This strip OWNS the scan (repetition rule, #82): a field shown here may reappear below only at
// a decision point (deadline in the sticky bar / timeline, entry pathway at the Register button
// and under Eligibility). Format + Delivery moved up from the Details tab; "How to enter" moved
// OUT (Register area + Eligibility group). Category + Status were the header tags until #88.
// Every item in this list ALWAYS renders (owner 2026-08-23): each value has a truthful fallback
// — "All grades", "Paid", "TBD" for an unknown deadline, "Bragging rights" for an uncurated
// prize — so the strip has the same shape on every competition and a missing fact never reads as
// an absent one. Status is the exception, and it left the strip entirely (breadcrumb action row).

interface Item {
  key: string;
  icon: ComponentType<{ className?: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' }>;
  label: string;
  value: string;
  /** Secondary line under the value — only where it adds a fact the value alone withholds. */
  hint?: string;
  /** Makes the value a link. Only Category has one (its hub); the rest are plain facts. */
  href?: string;
  /** Tile tint classes (category accent / gold). Ignored while `urgent` owns the tile. */
  tileTone?: string;
  urgent?: boolean;
}

export function AtAGlance({ competition }: { competition: CompetitionDetail }) {
  const edition = currentEdition(competition.editions);
  const opens = regOpensAt(competition.editions);
  const deadline = nextDeadline(competition.editions);
  const prize = prizeLabel(edition);

  const art = categoryArt(competition.category.slug);

  const items: Item[] = [
    // 1. WHAT IS IT
    {
      key: 'category',
      // The category's OWN icon AND its accent tint (`art.tag` — the same class bundle the
      // CategoryTag used): the tag's whole identity survives the move into the strip, and it ties
      // the panel back to the colour-coded card grid instead of going fully grey.
      icon: art.icon,
      label: 'Category',
      value: competition.category.name,
      href: `/competitions/${competition.category.slug}`,
      tileTone: art.tag,
    },
    // 2. WHO CAN ENTER — the eligibility pair.
    {
      key: 'grades',
      icon: GraduationCap,
      label: 'Grades',
      value: gradeLabel(competition.minGrade, competition.maxGrade) ?? 'All grades',
    },
    {
      key: 'format',
      icon: Users,
      label: 'Format',
      value: participationLabel(competition.participationMode),
    },
  ];

  // 3. WHEN. (Status left the strip 2026-08-23 — it rides the breadcrumb action row as a tag,
  // next to Follow/Share, where "can we still enter" reads before any tab is opened.)
  if (opens) {
    // Registration hasn't opened (#82): "Opens Mar 3" — a bare close date here implied you could
    // enter now. The close date still lives in the Key dates timeline.
    items.push({
      key: 'deadline',
      icon: Clock,
      label: 'Registration',
      value: `Opens ${formatDate(opens.iso, opens.timezone ?? undefined)}`,
    });
  } else if (deadline) {
    // Relative value + absolute date underneath — see deadlineFact (pinned by detail-display.test).
    const fact = deadlineFact(deadline);
    items.push({
      key: 'deadline',
      icon: Clock,
      label: 'Next deadline',
      value: fact.value,
      hint: fact.hint,
      urgent: fact.urgent,
    });
  } else {
    // No usable date: either a deadline milestone exists with a TBD date (R1-18) or the
    // competition has no future reg_close/submission_due at all. The slot still renders
    // (owner 2026-08-23) — an absent row read as "no deadline to worry about"; "TBD" says the
    // truth, that we don't know it yet, and keeps the strip's fixed shape across competitions.
    items.push({ key: 'deadline', icon: Clock, label: 'Next deadline', value: 'TBD' });
  }

  items.push(
    // 4. WHAT IT COSTS
    { key: 'cost', icon: Ticket, label: 'Cost', value: costLabel(competition, edition) },
    // 5. HOW / WHERE — Delivery answers "do we travel at all?", so it leads Location; the two
    // were split by Format before.
    {
      key: 'delivery',
      icon: Globe,
      label: 'Delivery',
      value: deliveryLabel(competition.delivery),
    },
    {
      key: 'location',
      icon: MapPin,
      label: 'Location',
      value: locationLabel(competition, edition),
    },
    // Recurrence moved HERE from the old Details tab's format group (#87) — it's an overview
    // fact ("runs every year"), and the tab that used to hold it became Judging.
    {
      key: 'recurrence',
      icon: Restore,
      label: 'Runs',
      value: recurrenceLabel(competition.recurrence),
    },
  );
  // 6. PAYOFF — last on purpose: it is the reward, and the one value long enough to want the
  // full phone width (col-span-2 below), which only works cleanly on the final row.
  items.push({ key: 'prize', icon: Trophy, label: 'Prize', value: prize });

  return (
    // No chrome of its own since #94: this renders INSIDE the detail tabs' filled card as the
    // first tab, so the TabPanel supplies the box, the padding, and (via aria-labelledby from the
    // "At a glance" tab itself) the accessible name. The #91 no-visible-heading decision carries
    // over — the tab label plays that role now.
    // UNEVEN COLUMNS at sm+ (owner 2026-08-27, #116): the middle column is narrower because its
    // three values are always the short ones. The strip renders exactly NINE items in a fixed
    // order — category · grades · format · (registration|deadline) · cost · delivery · location ·
    // runs · prize — and every branch above pushes exactly one item per slot, so the column each
    // field lands in is STABLE, not a coincidence of this listing:
    //   left   Category · Registration/Deadline · Location   (long: names, dates, place lists)
    //   middle Grades · Cost · Runs                          (short: "Grades 9–12", "$45.00")
    //   right  Format · Delivery · Prize                     (long: the prize line especially)
    // ⚠ If a future item is added or made conditional, that mapping shifts and this ratio stops
    // matching the content — re-check the three columns before changing the item list.
    //
    // minmax(0, …fr), NOT a bare `1.1fr` (owner 2026-08-27, #117 — "keep a consistent ratio").
    // A bare fr track is minmax(AUTO, 1.1fr): its floor is the content's min-content width, so any
    // cell with a long unbreakable value silently widens its whole column and steals the
    // difference from the others. That is what happened here — the Prize line pinned the right
    // column at ~310px and the ratio bent to 216/131/310 on a narrow main column. Flooring at 0
    // makes the three tracks hold their proportions at EVERY width; the cost is that a long value
    // now truncates (as the strip's one-line design intends, `title` carrying the full text)
    // instead of pushing its column wider.
    <dl className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)]">
      {items.map((item) => {
        const Icon = item.icon;
        const isPrize = item.key === 'prize';
        const value = (
          <>
            {item.value}
            {item.href && (
              <ArrowUpRight
                aria-hidden="true"
                className="ml-0.5 inline size-3.5 shrink-0 align-[-0.1em] text-muted"
              />
            )}
          </>
        );
        return (
          <div
            key={item.key}
            className={cn(
              'flex items-start gap-3',
              // Prize is the one value long enough to need a second column on phones; letting it
              // span also keeps the 2-col grid's last row full instead of half-empty.
              isPrize && 'col-span-2 sm:col-span-1',
            )}
          >
            {/* Icon TILE rather than a bare glyph: gives every cell a fixed anchor so the
                  label/value column starts on the same line across the whole grid. Three tints
                  are possible and they
                  rank: urgent (deadline) wins over the category accent and the gold prize, because
                  a closing deadline is the one thing that should pull the eye first. */}
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-xl border border-transparent',
                item.urgent && 'bg-danger-soft text-danger',
                !item.urgent && item.tileTone,
                // Tile ground is `surface` again since #99: the pill variant's panel card
                // is surface-raised (white), so gray tiles separate; a white tile would
                // dissolve into it.
                !item.urgent && !item.tileTone && 'border-border bg-surface',
                !item.urgent && !item.tileTone && (isPrize ? 'text-brand-gold' : 'text-muted'),
              )}
            >
              <Icon
                aria-hidden="true"
                weight={isPrize || item.tileTone ? 'fill' : 'regular'}
                className="size-4.5"
              />
            </span>
            <div className="min-w-0 flex-1">
              <dt className="text-[11px] font-medium tracking-wide text-muted uppercase">
                {item.label}
              </dt>
              {/* ONE line, ellipsis past it (owner #91) — but only from sm up (mobile pass).
                    The lattice argument holds on a wide grid; on a phone the cells are ~114px, so
                    ordinary values were losing their tails ("Opens Aug 25, 2026" clipped to "Opens
                    Aug 25,"), and the `title` fallback is unreachable on touch — there is no hover.
                    Below sm the value wraps instead, which costs the even cell heights on the one
                    breakpoint where the grid is two columns and that evenness is least visible.
                    `title` still carries the full value for the sm+ truncated case, so do not drop
                    it. Prize keeps its both-column span below, which buys it roughly double the
                    characters either way. */}
              <dd
                title={item.value}
                className={cn(
                  'mt-0.5 text-sm leading-snug font-semibold break-words sm:truncate',
                  item.urgent ? 'text-danger' : 'text-foreground',
                )}
              >
                {item.href ? (
                  <Link
                    href={item.href}
                    className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {value}
                  </Link>
                ) : (
                  value
                )}
              </dd>
              {item.hint && (
                <p className="mt-0.5 text-xs text-muted break-words sm:truncate" title={item.hint}>
                  {item.hint}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </dl>
  );
}
