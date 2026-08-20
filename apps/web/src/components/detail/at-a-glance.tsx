import type { ComponentType } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Clock,
  Flag,
  Globe,
  GraduationCap,
  MapPin,
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
  editionStatusLabel,
  hasTbdDeadline,
  locationLabel,
  nextDeadline,
  participationLabel,
  prizeLabel,
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
// Prize, Status and deadline are omitted when unknown (rather than a hollow "—"); the order of
// whatever remains never changes.

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

  // 3. WHEN — Status and the deadline are one thought ("can we still enter, and by when?"), so
  // they sit together; the old order had Grades wedged between them.
  if (edition) {
    items.push({
      key: 'status',
      icon: Flag,
      label: 'Status',
      value: editionStatusLabel(edition.effectiveStatus),
    });
  }
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
  } else if (hasTbdDeadline(competition.editions)) {
    // A deadline milestone exists but its date is TBD (R1-18) — show it rather than omit.
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
  );
  // 6. PAYOFF — last on purpose: it is the reward, and the one value long enough to want the
  // full phone width (col-span-2 below), which only works cleanly on the final row.
  if (prize) {
    items.push({ key: 'prize', icon: Trophy, label: 'Prize', value: prize });
  }

  return (
    // No chrome of its own since #94: this renders INSIDE the detail tabs' filled card as the
    // first tab, so the TabPanel supplies the box, the padding, and (via aria-labelledby from the
    // "At a glance" tab itself) the accessible name. The #91 no-visible-heading decision carries
    // over — the tab label plays that role now.
    <dl className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3">
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
