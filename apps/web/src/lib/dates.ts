// Timezone-aware date helpers (review fix H1). Key dates come from the API as UTC instants
// with an optional IANA `timezone`; rendering them in the SERVER's zone (UTC in prod
// containers) shifts late-night deadlines to the next calendar day. Every display/day-math
// path goes through these helpers, viewed in the key date's own zone — falling back to
// Eastern (competitions are US-facing; deadlines are typically "11:59 PM ET"), never to
// server-local time. Pure + server/client safe.

export const DEFAULT_TIMEZONE = 'America/New_York';

interface Ymd {
  y: number;
  m: number;
  d: number;
}

/** Calendar Y/M/D of an instant as seen in a zone. */
function ymdInZone(date: Date, timeZone: string): Ymd {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** Absolute, human date — "Mar 3, 2026" — in the given zone (default Eastern). */
export function formatDate(iso: string, timeZone?: string | null): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: timeZone ?? DEFAULT_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "YYYY-MM-DD" in the given zone — schema.org date-only values. */
export function isoDateInZone(iso: string, timeZone?: string | null): string {
  const { y, m, d } = ymdInZone(new Date(iso), timeZone ?? DEFAULT_TIMEZONE);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "YYYYMMDD" in the given zone — ICS / Google Calendar all-day values. */
export function compactDateInZone(iso: string, timeZone?: string | null): string {
  return isoDateInZone(iso, timeZone).replace(/-/g, '');
}

/** "YYYYMMDD" of the NEXT calendar day (all-day events use an exclusive end date). */
export function compactNextDayInZone(iso: string, timeZone?: string | null): string {
  const { y, m, d } = ymdInZone(new Date(iso), timeZone ?? DEFAULT_TIMEZONE);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, '0')}${String(
    next.getUTCDate(),
  ).padStart(2, '0')}`;
}

/**
 * Whole CALENDAR days from `now` until `iso`, both viewed in the zone. 0 = same calendar day
 * ("closes today"), 1 = tomorrow, negative = past. Clock-diff math (Math.ceil of ms) gets
 * this wrong twice over: tonight's deadline reads "1 day to go" and a just-passed one rounds
 * to -0 and slips through `< 0` guards (review fix M6).
 */
export function calendarDaysUntil(iso: string, now: Date, timeZone?: string | null): number {
  const tz = timeZone ?? DEFAULT_TIMEZONE;
  const a = ymdInZone(now, tz);
  const b = ymdInZone(new Date(iso), tz);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

/** True when two instants fall on the same calendar day in the zone. */
export function sameCalendarDay(a: string, b: string, timeZone?: string | null): boolean {
  return isoDateInZone(a, timeZone) === isoDateInZone(b, timeZone);
}

/** The zone's UTC offset (ms) at instant `t`: (wall-clock of t in zone) − t. */
function offsetAt(t: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  let hour = get('hour');
  if (hour === 24) hour = 0; // some engines render midnight as "24"
  const wall = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return wall - t;
}

/**
 * A wall-clock string from a `datetime-local` input ("YYYY-MM-DDTHH:mm") interpreted in the
 * given IANA zone → the UTC instant (ISO string). This is the ADMIN WRITE path: an admin types
 * "7:00 PM" and picks "America/New_York"; we must store the correct UTC instant regardless of
 * the server's own zone (the old `new Date(local).toISOString()` used the server zone — wrong).
 *
 * Two-pass DST-safe probe: correct the naive UTC guess by the zone's offset at that guess, then
 * re-probe once in case the correction stepped across a DST boundary. Server/client safe (Intl).
 */
export function zonedWallClockToInstant(local: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!match) throw new Error(`invalid datetime-local value: ${local}`);
  const asUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let ts = asUtc - offsetAt(asUtc, timeZone);
  ts = asUtc - offsetAt(ts, timeZone);
  return new Date(ts).toISOString();
}

/** "Mar 3, 2026, 7:00 PM EST" — full date + time + zone abbreviation, in the zone. */
export function formatInZone(iso: string, timeZone?: string | null): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: timeZone ?? DEFAULT_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}
