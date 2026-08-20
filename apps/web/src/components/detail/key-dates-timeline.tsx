import { Check, cn } from '@beecompete/ui';
import { AddToCalendar } from '@/components/detail/add-to-calendar';
import { timelineDates } from '@/lib/detail-display';
import { formatDate, sameCalendarDay } from '@/lib/dates';
import type { EditionView } from '@/lib/catalog-types';

// The edition's key-date timeline (blueprints Page 3.4b): reg opens → closes → rounds →
// results, current/next date emphasized with an add-to-calendar link at R1 (no account). Past
// dates render muted; the first future date is the "next" one and carries the calendar link.
// Past/next tagging is derived in the lib (keeps this component pure — no Date in render).
// Dates render in the key date's own zone (review fix H1) and multi-day spans show a range.

export function KeyDatesTimeline({
  edition,
  competitionName,
  competitionSlug,
}: {
  edition: EditionView;
  competitionName: string;
  competitionSlug: string;
}) {
  const dates = timelineDates(edition);
  if (dates.length === 0) return null;

  return (
    // role="list" restored explicitly — `list-none` strips list semantics in Safari/VoiceOver.
    <ol role="list" className="relative ml-1 list-none border-l border-border">
      {dates.map(({ date, label, past, isNext, isTbd }, i) => {
        const multiDay =
          !isTbd &&
          date.startsAt &&
          date.endsAt &&
          !sameCalendarDay(date.startsAt, date.endsAt, date.timezone);
        return (
          <li key={`${date.type}-${date.startsAt}-${i}`} className="ml-4 pb-5 last:pb-0">
            {/* Past milestones get a CHECK in the marker (#84) — "done", not just dimmed.
                Future/next keep the plain dot; markers stay aria-hidden with the sr-only
                "(completed)" on the label carrying the semantics. */}
            {past ? (
              <span
                aria-hidden="true"
                className="absolute -left-[8px] mt-1 grid size-4 place-items-center rounded-full bg-border ring-4 ring-[var(--surface-raised)]"
              >
                <Check weight="bold" className="size-2.5 text-muted" />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -left-[5px] mt-1.5 size-2.5 rounded-full ring-4 ring-[var(--surface-raised)]',
                  isNext ? 'bg-brand-gold' : 'bg-muted',
                )}
              />
            )}
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className={cn('text-sm font-medium', past ? 'text-muted' : 'text-foreground')}>
                {label}
                {past && <span className="sr-only"> (completed)</span>}
              </p>
              {isNext && (
                <span className="rounded-full bg-brand-gold-soft px-2 py-0.5 text-[11px] font-medium text-foreground">
                  Next
                </span>
              )}
            </div>
            {/* Full-strength muted (not /70) — the dimmed variant fell below AA (2.97:1 light,
                3.94:1 dark). #84 dropped the line-through: strikethrough reads as CANCELLED, and a
                passed milestone is completed, not cancelled — the check marker + sr-only
                "(completed)" carry that now. TBD renders as text (R1-18). */}
            <p className="text-sm text-muted">
              {isTbd || !date.startsAt ? (
                'Date TBD'
              ) : (
                <>
                  {formatDate(date.startsAt, date.timezone)}
                  {multiDay && ` – ${formatDate(date.endsAt as string, date.timezone)}`}
                </>
              )}
            </p>
            {isNext && date.startsAt && (
              <AddToCalendar
                title={`${competitionName}: ${label}`}
                start={date.startsAt}
                end={date.endsAt ?? undefined}
                timezone={date.timezone}
                // Stable across date EDITS (a corrected date updates the calendar event
                // instead of duplicating it); only the single "next" date renders a link,
                // so same-type collisions can't produce two live links at once.
                uid={`${competitionSlug}-${date.type}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
