import { describe, expect, it } from 'vitest';
import {
  BOUNDS,
  currencyRule,
  intRule,
  isComplete,
  LIMITS,
  moneyRule,
  rangeRule,
  slugRule,
  textRule,
  urlRule,
} from '@/lib/form-rules';

describe('textRule', () => {
  it('says nothing about an empty OPTIONAL field', () => {
    expect(textRule('', { max: 10 })).toBeUndefined();
  });

  it('reports an empty REQUIRED field by its label', () => {
    expect(textRule('   ', { max: 10, required: true, label: 'Name' })).toBe('Name is required.');
  });

  it('measures the TRIMMED value, so trailing spaces never trip the cap', () => {
    expect(textRule(`${'a'.repeat(10)}     `, { max: 10 })).toBeUndefined();
  });

  it('names both the actual length and the limit', () => {
    const msg = textRule('a'.repeat(301), { max: LIMITS.name });
    expect(msg).toContain('301');
    expect(msg).toContain('300');
  });
});

describe('urlRule', () => {
  it('accepts an ordinary https URL', () => {
    expect(urlRule('https://maa.org/amc', { max: 1000 })).toBeUndefined();
  });

  it('rejects a bare word — the case the old non-empty check let through', () => {
    expect(urlRule('asdf', { max: 1000 })).toBe('Enter a full URL, starting with https://');
  });

  it('names the scheme when it is one we cannot render', () => {
    expect(urlRule('mailto:a@b.com', { max: 1000 })).toContain('mailto');
  });

  it('rejects a scheme with no domain', () => {
    expect(urlRule('https://', { max: 1000 })).toBeTruthy();
    expect(urlRule('https://localhost', { max: 1000 })).toBe('That URL has no domain name.');
  });

  it('reports length before shape, so one message shows at a time', () => {
    expect(urlRule(`https://x.com/${'a'.repeat(1000)}`, { max: 1000 })).toContain('limit');
  });
});

describe('slugRule', () => {
  it('accepts lowercase kebab-case', () => {
    expect(slugRule('amc-10-2026')).toBeUndefined();
  });

  it.each(['AMC-10', 'amc_10', 'amc--10', '-amc', 'amc-'])('rejects %s', (bad) => {
    expect(slugRule(bad)).toBeTruthy();
  });
});

describe('intRule', () => {
  it('accepts the grade ladder ends, including the negative Pre-K rung', () => {
    const g = { min: BOUNDS.grade.min, max: BOUNDS.grade.max };
    expect(intRule('-1', g)).toBeUndefined();
    expect(intRule('17', g)).toBeUndefined();
    expect(intRule('18', g)).toBe('Must be between -1 and 17.');
  });

  it('treats empty as empty, not as zero', () => {
    expect(intRule('', { min: 0, max: 99 })).toBeUndefined();
    expect(intRule('', { min: 0, max: 99, required: true, label: 'Age' })).toBe('Age is required.');
  });

  it('rejects a decimal', () => {
    expect(intRule('7.5', { min: 0, max: 99 })).toBe('Enter a whole number.');
  });
});

describe('moneyRule', () => {
  it('accepts whole and 2dp amounts', () => {
    expect(moneyRule('25')).toBeUndefined();
    expect(moneyRule('25.00')).toBeUndefined();
    expect(moneyRule('0')).toBeUndefined();
  });

  it('rejects symbols, negatives and 3dp', () => {
    expect(moneyRule('$25')).toBeTruthy();
    expect(moneyRule('-5')).toBeTruthy();
    expect(moneyRule('25.005')).toBe('At most 2 decimal places.');
  });

  it('rejects more integer digits than @Digits allows', () => {
    expect(moneyRule('1'.repeat(11))).toContain('10 digits');
    // Leading zeros are not significant digits, so this must still pass.
    expect(moneyRule(`0000${'1'.repeat(10)}`)).toBeUndefined();
  });
});

describe('currencyRule', () => {
  it('accepts a 3-letter uppercase code and rejects the rest', () => {
    expect(currencyRule('USD')).toBeUndefined();
    expect(currencyRule('usd')).toBeTruthy();
    expect(currencyRule('US')).toBeTruthy();
    expect(currencyRule('US$')).toBeTruthy();
  });
});

describe('rangeRule', () => {
  it('flags an inverted range', () => {
    expect(rangeRule('12', '9', 'grade')).toBe('Lowest grade must not be above the highest.');
  });

  it('allows equal bounds and one-sided ranges', () => {
    expect(rangeRule('9', '9')).toBeUndefined();
    expect(rangeRule('9', '')).toBeUndefined();
    expect(rangeRule('', '12')).toBeUndefined();
  });

  it('stays silent on malformed input — intRule owns that message', () => {
    expect(rangeRule('abc', '9')).toBeUndefined();
  });
});

describe('isComplete', () => {
  it('needs a value AND no error — the whole point of the pass', () => {
    expect(isComplete('hello', undefined)).toBe(true);
    expect(isComplete('', undefined)).toBe(false);
    // Non-empty but invalid must NOT count as filled in.
    expect(isComplete('asdf', 'Enter a full URL, starting with https://')).toBe(false);
  });
});
