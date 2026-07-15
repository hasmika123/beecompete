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
 * study). FIXED-SLOT anatomy (owner 2026-07-13, blueprints #35): every card renders the same
 * rows at the same heights — cover → 1 line tags → 1 line title → 1 line organizer (blank
 * reserved space when unattributed) → exactly 2 lines description → Cost/Region facts row →
 * PRIZE-bold/deadline-quiet footer (Kaggle pattern, owner r8). Slots reserve their height even
 * when the data is missing, so a row of mixed sparse/full cards keeps every horizontal rule
 * aligned. The whole card is one link, with a Share button in the top-right corner (A8).
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

      <div className="flex flex-col gap-1 p-4 pb-3">
        {/* Slot 1 — tags, exactly one fixed-height line: the category tag truncates if needed,
            the grade badge never shrinks (and its absence can't change the row height). */}
        <div className="flex h-6 items-center gap-1.5 overflow-hidden">
          <CategoryTag slug={data.categorySlug} name={data.categoryName} />
          {data.gradeLabel && (
            <Badge variant="outline" className="shrink-0">
              {data.gradeLabel}
            </Badge>
          )}
        </div>
        {/* Slot 2 — single-line title (owner 2026-07-13): long names trail off with an ellipsis
            rather than wrapping. */}
        <CardTitle className="truncate pt-1 text-lg">{data.name}</CardTitle>
        {/* Slot 3 — organizer line, ALWAYS one reserved line (fixed-slot rule): unattributed
            listings keep the blank space (owner 2026-07-13 — never imply an organizer that
            isn't on record), so the description/facts below stay row-aligned across cards. */}
        <div className="flex h-6 items-center gap-2" data-testid="organizer-slot">
          {data.organizerName && (
            <>
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
            </>
          )}
        </div>
        {/* Slot 4 — description, ALWAYS exactly two lines tall: clamp caps it, `2lh` reserves
            it (lh tracks the real line-height), so a missing/short summary leaves blank space
            instead of pulling the facts row up. */}
        <CardDescription className="line-clamp-2 min-h-[2lh]" data-testid="summary-slot">
          {data.summary}
        </CardDescription>
      </div>

      {/* Two logistics facts in fixed half-width slots (owner r10): Cost + Region. With every
          slot above fixed-height, `mt-auto` is a safety net rather than the aligner — it keeps
          this row (and the footer) bottom-pinned even if a future slot goes variable. */}
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
