'use client';

import { CalendarPlus, ExternalLink } from '@beecompete/ui';
import { compactDateInZone, compactNextDayInZone } from '@/lib/dates';

// Per-date add-to-calendar (blueprints Page 3, decision #17): ics download + Google link, no
// account needed at R1. Client component — the .ics is built and downloaded in-browser (no
// server round-trip, no PII).
//
// Key dates are day-grained, so both targets get ALL-DAY events computed in the key date's
// own timezone (review fixes H1/M4) — a timed UTC event would land a midnight-ET deadline at
// 4:59 AM on the wrong calendar day. ICS text is RFC 5545-escaped and folded, and the UID is
// derived from stable data so a re-download updates instead of duplicating.

interface AddToCalendarProps {
  title: string;
  /** ISO instant of the date. */
  start: string;
  /** ISO instant; multi-day events extend the all-day span. */
  end?: string;
  /** The key date's IANA zone (falls back to Eastern in lib/dates). */
  timezone?: string | null;
  /** Stable identity for the ICS UID (e.g. "<slug>-reg_close"); title changes must not churn it. */
  uid: string;
  details?: string;
}

/** RFC 5545 TEXT escaping — backslash first, then structural chars, then newlines. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold a content line at ≤75 octets (UTF-8), continuation lines prefixed with a space. */
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    // 74 for the first line, 73 for continuations (leading space counts) — 73 is safe for both.
    if (bytes + charBytes > 73) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += char;
    bytes += charBytes;
  }
  out.push(current);
  return out.join('\r\n');
}

function utcStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function AddToCalendar({ title, start, end, timezone, uid, details }: AddToCalendarProps) {
  // All-day span in the key date's zone; the end date is EXCLUSIVE per RFC 5545 / Google.
  const startDay = compactDateInZone(start, timezone);
  const endDayExclusive = compactNextDayInZone(end ?? start, timezone);

  const googleUrl = (() => {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${startDay}/${endDayExclusive}`,
    });
    if (details) params.set('details', details);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  })();

  const downloadIcs = () => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BeeCompete//EN',
      'BEGIN:VEVENT',
      `UID:${uid}@beecompete.com`,
      `DTSTAMP:${utcStamp(new Date())}`,
      `DTSTART;VALUE=DATE:${startDay}`,
      `DTEND;VALUE=DATE:${endDayExclusive}`,
      `SUMMARY:${escapeIcsText(title)}`,
      details ? `DESCRIPTION:${escapeIcsText(details)}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .map(foldIcsLine);
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${uid}.ics`;
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
