import { cn } from '@beecompete/ui';
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
      {dates.map(({ date, label, past, isNext }, i) => {
        const multiDay = date.endsAt && !sameCalendarDay(date.startsAt, date.endsAt, date.timezone);
        return (
          <li key={`${date.type}-${date.startsAt}-${i}`} className="ml-4 pb-5 last:pb-0">
            <span
              aria-hidden="true"
              className={cn(
                'absolute -left-[5px] mt-1.5 size-2.5 rounded-full ring-4 ring-[var(--surface-raised)]',
                isNext ? 'bg-brand-gold' : past ? 'bg-border' : 'bg-muted',
              )}
            />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className={cn('text-sm font-medium', past ? 'text-muted' : 'text-foreground')}>
                {label}
                {past && <span className="sr-only"> (past)</span>}
              </p>
              {isNext && (
                <span className="rounded-full bg-brand-gold-soft px-2 py-0.5 text-[11px] font-medium text-foreground">
                  Next
                </span>
              )}
            </div>
            {/* Full-strength muted (not /70) — the dimmed variant fell below AA (2.97:1 light,
                3.94:1 dark); line-through already signals "past". */}
            <p className={cn('text-sm', past ? 'text-muted line-through' : 'text-muted')}>
              {formatDate(date.startsAt, date.timezone)}
              {multiDay && ` – ${formatDate(date.endsAt as string, date.timezone)}`}
            </p>
            {isNext && (
              <AddToCalendar
                title={`${competitionName} — ${label}`}
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
