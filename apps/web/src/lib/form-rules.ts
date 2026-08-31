/**
 * Field rules for the curation form (owner 2026-08-30).
 *
 * ⚠ **These MIRROR the server; they do not invent limits.** Every number in {@link LIMITS} is the
 * matching Bean Validation constraint on `CompetitionRequest` / `EditionRequest` / `ResourceRequest`
 * / `FaqRequest` / `FirstEditionKeyDate`. The house rule is that the client mirrors server rules for
 * UX and the server stays the real gate — so when a limit was missing server-side (`FaqRequest.answer`
 * was `@NotBlank` with no `@Size`) the fix was to ADD it there and mirror it here, never to cap only
 * in the browser. A client-only limit is a lie: anything the API accepts still arrives through it.
 *
 * Kept out of the component so the rules are unit-testable without a DOM, the same split
 * `detail-display` and `import-seed` already use.
 *
 * Every rule returns a **message or `undefined`**. Undefined means "nothing to say" — which is not
 * the same as valid: an empty optional field returns undefined, and so does an empty REQUIRED field
 * unless `required` is set. That asymmetry is deliberate; see {@link isComplete}.
 */

/** Server-mirrored maximums. Names match the request-record fields they come from. */
export const LIMITS = {
  // CompetitionRequest
  name: 300,
  slug: 160,
  organizerName: 300,
  officialUrl: 1000,
  logo: 1000,
  description: 10_000,
  // EditionRequest
  cycleLabel: 60,
  registrationUrl: 1000,
  prizeSummary: 500,
  // FirstEditionKeyDate
  keyDateLabel: 200,
  timezone: 60,
  // ResourceRequest
  resourceTitle: 300,
  resourceUrl: 1000,
  resourceImageUrl: 1000,
  // FaqRequest — `answer` mirrors FaqRequest.MAX_ANSWER, added server-side for this pass.
  faqQuestion: 500,
  faqAnswer: 2000,
  /**
   * Attribute-backed (JSONB), so bounded by the Category Template schema rather than Bean
   * Validation. Capped here for the same UX reason, and flagged so nobody reads them as mirrored.
   */
  contactEmail: 320,
  contactPhone: 40,
} as const;

/** Inclusive numeric bounds, from `@Min`/`@Max` on CompetitionRequest. */
export const BOUNDS = {
  /** Pre-K −1 · K 0 · 1–12 school · 13–16 college years · 17 graduate. */
  grade: { min: -1, max: 17 },
  age: { min: 0, max: 99 },
  /** `@Min(1)` server-side; the upper bound is ours — a team of 1000 is a data-entry slip. */
  teamSize: { min: 1, max: 999 },
} as const;

/** `@PositiveOrZero @Digits(integer = 10, fraction = 2)`. */
export const MONEY = { maxIntegerDigits: 10, maxFractionDigits: 2 } as const;

export interface TextRuleOptions {
  max: number;
  /** Report an empty value as missing. Off by default so optional fields stay quiet. */
  required?: boolean;
  /** Used in the message; keep it the field's visible label. */
  label?: string;
}

const missing = (label?: string) => `${label ?? 'This field'} is required.`;

/** Plain text: required-ness and length. */
export function textRule(value: string, opts: TextRuleOptions): string | undefined {
  const v = value.trim();
  if (v === '') return opts.required ? missing(opts.label) : undefined;
  if (v.length > opts.max) {
    return `${v.length.toLocaleString()} characters — the limit is ${opts.max.toLocaleString()}.`;
  }
  return undefined;
}

/**
 * http(s) URL. Rejects other schemes explicitly rather than falling through to a generic message:
 * `mailto:` and `ftp:` parse fine as URLs but are not a link we can render, and a curator who typed
 * one deserves to be told which part is wrong.
 */
export function urlRule(value: string, opts: TextRuleOptions): string | undefined {
  const lengthProblem = textRule(value, opts);
  if (lengthProblem) return lengthProblem;
  const v = value.trim();
  if (v === '') return undefined;
  let parsed: URL;
  try {
    parsed = new URL(v);
  } catch {
    return 'Enter a full URL, starting with https://';
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return `${parsed.protocol.replace(':', '')} links aren’t supported — use https://`;
  }
  // "https://" alone parses, with an empty host.
  if (!parsed.hostname || !parsed.hostname.includes('.')) return 'That URL has no domain name.';
  return undefined;
}

/** Lowercase kebab-case, matching the server's `@Pattern` on `slug`. */
export function slugRule(value: string, opts: { required?: boolean } = {}): string | undefined {
  const lengthProblem = textRule(value, {
    max: LIMITS.slug,
    required: opts.required,
    label: 'Slug',
  });
  if (lengthProblem) return lengthProblem;
  const v = value.trim();
  if (v === '') return undefined;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) {
    return 'Lowercase letters, numbers and single hyphens only.';
  }
  return undefined;
}

export interface IntRuleOptions {
  min: number;
  max: number;
  required?: boolean;
  label?: string;
}

/** A whole number inside inclusive bounds. '' is empty, not zero. */
export function intRule(value: string, opts: IntRuleOptions): string | undefined {
  const v = value.trim();
  if (v === '') return opts.required ? missing(opts.label) : undefined;
  if (!/^-?\d+$/.test(v)) return 'Enter a whole number.';
  const n = Number(v);
  if (n < opts.min || n > opts.max) return `Must be between ${opts.min} and ${opts.max}.`;
  return undefined;
}

/** Money: non-negative, ≤10 digits before the point and ≤2 after (`@Digits`). */
export function moneyRule(value: string, opts: { required?: boolean; label?: string } = {}) {
  const v = value.trim();
  if (v === '') return opts.required ? missing(opts.label) : undefined;
  if (!/^\d+(\.\d+)?$/.test(v)) return 'Enter an amount like 25 or 25.00 — no symbols.';
  const [whole = '', fraction = ''] = v.split('.');
  if (whole.replace(/^0+(?=\d)/, '').length > MONEY.maxIntegerDigits) {
    return `That is larger than we can store (${MONEY.maxIntegerDigits} digits).`;
  }
  if (fraction.length > MONEY.maxFractionDigits) return 'At most 2 decimal places.';
  return undefined;
}

/** Exactly three uppercase letters (`@Pattern` on `currency` / `prizeCurrency`). */
export function currencyRule(value: string, opts: { required?: boolean } = {}): string | undefined {
  const v = value.trim();
  if (v === '') return opts.required ? missing('Currency') : undefined;
  return /^[A-Z]{3}$/.test(v) ? undefined : 'Use a 3-letter code, like USD.';
}

/**
 * `min ≤ max` for a pair of optional bounds, mirroring the server's `@AssertTrue` range checks.
 * Silent when either side is blank — one-sided ranges are legitimate ("grade 9 and up").
 */
export function rangeRule(min: string, max: string, noun = 'value'): string | undefined {
  const a = min.trim();
  const b = max.trim();
  if (a === '' || b === '') return undefined;
  if (!/^-?\d+$/.test(a) || !/^-?\d+$/.test(b)) return undefined; // intRule reports the shape
  return Number(a) <= Number(b) ? undefined : `Lowest ${noun} must not be above the highest.`;
}

/**
 * Whether a value COUNTS as filled in — the ring's `ok`, and the owner's "it should count that you
 * have not filled out a field if the field requirements are not met".
 *
 * Deliberately stricter than "not empty": a 12,000-character description and a URL of `asdf` are
 * both non-empty and both unusable, so neither completes its step.
 */
export function isComplete(value: string, error: string | undefined): boolean {
  return value.trim() !== '' && error === undefined;
}
