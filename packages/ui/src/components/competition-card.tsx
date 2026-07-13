import type { ElementType } from 'react';
import { MapPin, Ticket, Trophy, VerifiedSeal } from '../icons';
import { cn } from '../lib/cn';
import { Avatar } from './avatar';
import { Badge } from './badge';
import { Card, CardDescription, CardTitle } from './card';
import { CategoryCover, CategoryTag } from './category-art';
import { ShareMenu } from './share-menu';

/**
 * The CompetitionCard (blueprints "Shared components"; approved F7 direction from the /design
 * study). Equal-height flex column: cover → meta tags → title → organizer → blurb → two
 * fixed-slot facts (Cost + Region, owner r10, pinned to the card bottom) → footer with PRIZE
 * bold and the deadline quiet (Kaggle pattern, owner r8). The whole card is one link, with a
 * Share button in the top-right corner (A8, reveals on hover/focus).
 *
 * R1 variant: only Share is in the corner; the study's social-proof pill + Save arrive with
 * M31/M7 (R2) — the corner is a slot they drop into without relayout.
 *
 * Presentation-only: callers derive the display strings (grade band, deadline wording,
 * region label) — see apps/web `lib/catalog-display`.
 */
export interface CompetitionCardData {
  name: string;
  href: string;
  categorySlug: string;
  categoryName: string;
  /** e.g. "Grades 8–10" · "All grades" — derived by the caller (Q2 encoding lives there). */
  gradeLabel?: string;
  organizerName?: string;
  /**
   * Renders the verified seal on the organizer row. Verification is an ORGANIZATION property
   * (DQ13 — the ORG carries the seal); a competition itself is never "verified" (it's admin-
   * approved to be listed), so the card has no competition-level trust/"unverified" badge.
   */
  organizerVerified?: boolean;
  summary?: string;
  /** Cost fact: free renders positive (success green, owner r5). */
  free: boolean;
  /** Region fact value, e.g. "Texas" · "Texas +2" · "Nationwide". */
  regionLabel?: string;
  /** Prize line — the bold footer fact. Footer keeps its slot when absent (equal heights). */
  prizeLabel?: string;
  /** Deadline wording, e.g. "9 days to go" · "Closes Mar 3" · "Closed". */
  deadlineLabel?: string;
  /** Final-days tint (danger) — flips only near the end, not at 14 days (owner r8). */
  deadlineUrgent?: boolean;
}

export interface CompetitionCardProps {
  data: CompetitionCardData;
  /** Pass next/link's Link for client-side nav; defaults to a plain anchor. */
  linkComponent?: ElementType;
  /** Render the Share corner (default true). Opt out where the card must stay inert. */
  shareable?: boolean;
  className?: string;
}

export function CompetitionCard({
  data,
  linkComponent: LinkComponent = 'a',
  shareable = true,
  className,
}: CompetitionCardProps) {
  return (
    <Card
      interactive
      className={cn('group relative flex flex-col overflow-hidden', className)}
      data-testid="competition-card"
    >
      {/* Whole-card link (stretched); the corner Share button sits above it (z-20). */}
      <LinkComponent href={data.href} aria-label={data.name} className="absolute inset-0 z-10" />

      {shareable && (
        // z-20 so clicks hit Share, not the card link. Hidden until hover/focus on pointer
        // devices (pointer-events-none so it doesn't eat clicks meant for the link), always
        // visible + interactive on touch. The popover portals to <body>, so no clip.
        <div className="absolute top-2 right-2 z-20 opacity-0 transition-opacity pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
          <ShareMenu variant="icon" path={data.href} title={data.name} />
        </div>
      )}

      <CategoryCover slug={data.categorySlug} className="h-36" />

      <div className="flex flex-col gap-1 p-4 pb-0">
        {/* Tags stay on a single line (approved design): the category tag truncates if needed,
            the grade badge never shrinks. */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          <CategoryTag slug={data.categorySlug} name={data.categoryName} />
          {data.gradeLabel && (
            <Badge variant="outline" className="shrink-0">
              {data.gradeLabel}
            </Badge>
          )}
        </div>
        {/* Single-line title (owner 2026-07-13): long names trail off with an ellipsis rather
            than wrapping, so every card's header block is the same height. */}
        <CardTitle className="truncate pt-1 text-lg">{data.name}</CardTitle>
        {data.organizerName && (
          <div className="flex items-center gap-2">
            <Avatar name={data.organizerName} size="sm" className="size-6 text-[10px]" />
            <span className="truncate text-sm text-muted">{data.organizerName}</span>
            {data.organizerVerified && (
              <VerifiedSeal
                weight="fill"
                role="img"
                aria-label="Verified organizer"
                className="size-4 shrink-0 text-success"
              />
            )}
          </div>
        )}
        {data.summary && <CardDescription className="line-clamp-2">{data.summary}</CardDescription>}
      </div>

      {/* Two logistics facts in fixed half-width slots (owner r10): Cost + Region. `mt-auto`
          pins this row (and the footer below it) to the card bottom, so the facts sit in the
          same place on every card regardless of how much body content there is above. */}
      <div className="mt-auto grid grid-cols-2 gap-x-3 border-t border-border p-4 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Ticket
            aria-hidden="true"
            className={cn('size-4 shrink-0', data.free ? 'text-success' : 'text-muted')}
          />
          <span
            className={cn(
              'truncate text-sm',
              data.free ? 'font-semibold text-success' : 'font-medium text-foreground',
            )}
          >
            {data.free ? 'Free' : 'Paid'}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted" />
          <span className="truncate text-sm font-medium text-foreground">
            {data.regionLabel ?? '—'}
          </span>
        </div>
      </div>

      {/* Footer: PRIZE bold + deadline quiet (Kaggle pattern, owner r8). Sits directly under
          the facts row, both anchored to the bottom via the facts row's mt-auto. */}
      <div className="flex items-center justify-between gap-2.5 border-t border-border p-4 py-3">
        <span className="flex min-w-0 items-center gap-1.5">
          {data.prizeLabel ? (
            <>
              <Trophy
                aria-hidden="true"
                weight="fill"
                className="size-4 shrink-0 text-brand-gold"
              />
              <strong className="truncate text-sm font-semibold text-foreground">
                {data.prizeLabel}
              </strong>
            </>
          ) : (
            <span className="text-sm text-muted">—</span>
          )}
        </span>
        {data.deadlineLabel && (
          <span
            className={cn(
              'shrink-0 text-xs',
              data.deadlineUrgent ? 'font-medium text-danger' : 'text-muted',
            )}
          >
            {data.deadlineLabel}
          </span>
        )}
      </div>
    </Card>
  );
}
