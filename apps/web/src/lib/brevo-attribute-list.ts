// Multi-value encoding for a Brevo TEXT contact attribute (R1-15c follow-up).
//
// A Brevo contact attribute holds ONE value, so following a second competition used to overwrite
// the first — you'd only ever know the most recent one, and the earlier follows silently stopped
// being mailable. We encode a list into the text attribute instead.
//
// WHY TEXT AND NOT `multiple-choice`: Brevo does have a real multi-value attribute type, but every
// possible value must be pre-registered as an option (`multiCategoryOptions`). With a curated
// catalog of 200+ growing listings that means syncing an option into Brevo before each new
// competition's first follower — a background job whose lag silently drops follow data. A text
// attribute accepts any competition the moment it's published.
//
// ENCODING: every entry is wrapped in delimiters — `|AMC 10|MATHCOUNTS|` — so a Brevo segment can
// filter on *contains* `|AMC 10|` without "AMC 10" also matching a listing called "AMC 10/12".
// The leading and trailing delimiters are what make the first and last entries safe to match.

const DELIMITER = '|';

/** Brevo text attributes cap at 10,000 chars; stay well under it. */
const MAX_ENCODED_LENGTH = 9000;

/** Matches the pre-existing COMPETITION truncation so one entry can't dominate the budget. */
const MAX_ENTRY_LENGTH = 200;

/**
 * Make a value safe to store as one entry: the delimiter can't survive inside an entry or it would
 * split into two bogus ones. Competition names with a pipe are vanishingly rare, but a single
 * stray character silently corrupting someone's follow list is not a failure worth allowing.
 */
export function sanitizeEntry(value: string): string {
  return value.replaceAll(DELIMITER, '/').trim().slice(0, MAX_ENTRY_LENGTH);
}

/** Decode a stored attribute value into its entries. Tolerates unset/legacy/non-string values. */
export function parseAttributeList(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  return raw
    .split(DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** Encode entries back into the delimiter-wrapped form Brevo stores. Empty list → empty string. */
export function encodeAttributeList(values: string[]): string {
  if (values.length === 0) return '';
  return `${DELIMITER}${values.join(DELIMITER)}${DELIMITER}`;
}

/** Case-insensitive membership — "AMC 10" and "amc 10" are the same competition to a human. */
export function attributeListHas(values: string[], value: string): boolean {
  const needle = sanitizeEntry(value).toLowerCase();
  return values.some((v) => v.toLowerCase() === needle);
}

/**
 * Append an entry, ignoring duplicates. Returns the existing list unchanged when the value is
 * already present, so the caller can detect a no-op and skip the write entirely.
 *
 * Oldest entries are dropped if the encoded form would exceed Brevo's text limit — a runaway list
 * would otherwise 400 the whole update and take the signup down with it.
 */
export function addToAttributeList(values: string[], value: string): string[] {
  const entry = sanitizeEntry(value);
  if (entry === '' || attributeListHas(values, entry)) return values;

  const next = [...values, entry];
  while (next.length > 1 && encodeAttributeList(next).length > MAX_ENCODED_LENGTH) next.shift();
  return next;
}
