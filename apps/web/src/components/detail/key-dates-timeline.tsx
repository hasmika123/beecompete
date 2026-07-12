import { cn } from '@beecompete/ui';
import { AddToCalendar } from '@/components/detail/add-to-calendar';
import { formatDate, timelineDates } from '@/lib/detail-display';
import type { EditionView } from '@/lib/catalog-types';

// The edition's key-date timeline (blueprints Page 3.4b): reg opens → closes → rounds →
// results, current/next date emphasized with an add-to-calendar link at R1 (no account). Past
// dates render muted; the first future date is the "next" one and carries the calendar link.
// Past/next tagging is derived in the lib (keeps this component pure — no Date in render).

export function KeyDatesTimeline({
  edition,
  competitionName,
}: {
  edition: EditionView;
  competitionName: string;
}) {
  const dates = timelineDates(edition);
  if (dates.length === 0) return null;

  return (
    <ol className="relative ml-1 list-none border-l border-border">
      {dates.map(({ date, label, past, isNext }, i) => (
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
            </p>
            {isNext && (
              <span className="rounded-full bg-brand-gold-soft px-2 py-0.5 text-[11px] font-medium text-foreground">
                Next
              </span>
            )}
          </div>
          <p className={cn('text-sm', past ? 'text-muted/70 line-through' : 'text-muted')}>
            {formatDate(date.startsAt)}
          </p>
          {isNext && (
            <AddToCalendar
              title={`${competitionName} — ${label}`}
              start={date.startsAt}
              end={date.endsAt ?? undefined}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
