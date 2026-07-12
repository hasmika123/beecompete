'use client';

import { CalendarPlus, ExternalLink } from '@beecompete/ui';

// Per-date add-to-calendar (blueprints Page 3, decision #17): ics download + Google link, no
// account needed at R1. Client component — the .ics is built and downloaded in-browser (no
// server round-trip, no PII). Dates are day-grained; a date with no explicit end gets a
// 1-hour block so both calendars accept it.

interface AddToCalendarProps {
  title: string;
  /** ISO instant of the date. */
  start: string;
  /** ISO instant; defaults to start + 1h. */
  end?: string;
  details?: string;
  location?: string;
}

function stamp(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function endOrDefault(start: string, end?: string): string {
  if (end) return end;
  return new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
}

export function AddToCalendar({ title, start, end, details, location }: AddToCalendarProps) {
  const finalEnd = endOrDefault(start, end);

  const googleUrl = (() => {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${stamp(start)}/${stamp(finalEnd)}`,
    });
    if (details) params.set('details', details);
    if (location) params.set('location', location);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  })();

  const downloadIcs = () => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BeeCompete//EN',
      'BEGIN:VEVENT',
      `UID:${stamp(start)}-${title.replace(/\s+/g, '-').toLowerCase()}@beecompete.com`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(finalEnd)}`,
      `SUMMARY:${title}`,
      details ? `DESCRIPTION:${details.replace(/\n/g, '\\n')}` : '',
      location ? `LOCATION:${location}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean);
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  return (
    <span className="mt-1 inline-flex items-center gap-2 text-xs">
      <CalendarPlus aria-hidden="true" className="size-3.5 text-muted" />
      <span className="text-muted">Add to</span>
      <a
        href={googleUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-2 hover:underline"
      >
        Google
        <ExternalLink aria-hidden="true" className="size-3" />
      </a>
      <span aria-hidden="true" className="text-border">
        ·
      </span>
      <button
        type="button"
        onClick={downloadIcs}
        className="font-medium text-foreground underline-offset-2 hover:underline"
      >
        iCal
      </button>
    </span>
  );
}
