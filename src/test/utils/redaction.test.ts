/**
 * Unit tests for the PII redaction utility.
 *
 * Covers:
 *  - Individual PII pattern detection
 *  - redact() function correctness
 *  - Multiple matches in same string
 *  - Non-PII text left unchanged
 *  - Large document performance (basic smoke test)
 *  - Extensibility (custom patterns)
 *  - findPiiMatches() helper
 *  - getRedactionToken() helper
 */

import { describe, it, expect } from 'vitest';
import {
  redact,
  findPiiMatches,
  getRedactionToken,
  PII_PATTERNS,
  PiiPattern,
} from '../../utils/redaction';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BRACKET = '[REDACTED]';
const BLOCK = '██████████';

// ---------------------------------------------------------------------------
// getRedactionToken
// ---------------------------------------------------------------------------

describe('getRedactionToken', () => {
  it('returns bracket token by default', () => {
    expect(getRedactionToken()).toBe(BRACKET);
    expect(getRedactionToken('bracket')).toBe(BRACKET);
  });

  it('returns block token for block style', () => {
    expect(getRedactionToken('block')).toBe(BLOCK);
  });
});

// ---------------------------------------------------------------------------
// redact() — edge cases
// ---------------------------------------------------------------------------

describe('redact() edge cases', () => {
  it('returns empty string for empty input', () => {
    expect(redact('')).toBe('');
  });

  it('returns input unchanged when it contains no PII', () => {
    const text = 'This is a clean legal agreement with no personal information.';
    expect(redact(text)).toBe(text);
  });

  it('does not mutate the original input string', () => {
    const original = 'Contact user@example.com for details.';
    const copy = original;
    redact(original);
    expect(original).toBe(copy);
  });

  it('handles null/undefined input gracefully', () => {
    // @ts-expect-error — testing runtime safety
    expect(redact(null)).toBe(null);
    // @ts-expect-error
    expect(redact(undefined)).toBe(undefined);
  });

  it('uses block token when style is "block"', () => {
    const result = redact('Email user@test.com here.', 'block');
    expect(result).toContain(BLOCK);
    expect(result).not.toContain('user@test.com');
  });

  it('uses bracket token when style is "bracket" (default)', () => {
    const result = redact('Email user@test.com here.');
    expect(result).toContain(BRACKET);
    expect(result).not.toContain('user@test.com');
  });
});

// ---------------------------------------------------------------------------
// Email detection
// ---------------------------------------------------------------------------

describe('Email redaction', () => {
  it('redacts a simple email address', () => {
    const result = redact('Send it to user@example.com please.');
    expect(result).not.toContain('user@example.com');
    expect(result).toContain(BRACKET);
  });

  it('redacts email with plus alias', () => {
    const result = redact('Forward to john.doe+alias@company.co.uk');
    expect(result).not.toContain('@');
  });

  it('leaves non-email text unchanged', () => {
    const text = 'This is not an email address.';
    expect(redact(text)).toBe(text);
  });

  it('redacts multiple emails in the same text', () => {
    const result = redact('Contact a@b.com or c@d.org for help.');
    expect(result).not.toContain('@');
  });
});

// ---------------------------------------------------------------------------
// Phone number detection
// ---------------------------------------------------------------------------

describe('Phone number redaction', () => {
  it('redacts Indian 10-digit number', () => {
    const result = redact('Call me at 9876543210.');
    expect(result).not.toContain('9876543210');
  });

  it('redacts US-style number with dashes', () => {
    const result = redact('US number: 555-867-5309.');
    expect(result).not.toContain('867-5309');
  });

  it('redacts international number with country code', () => {
    const result = redact('Dial +91 98765 43210 to reach us.');
    expect(result).not.toContain('98765 43210');
  });
});

// ---------------------------------------------------------------------------
// Credit / Debit card detection
// ---------------------------------------------------------------------------

describe('Credit card redaction', () => {
  it('redacts a Visa card number', () => {
    const result = redact('Card: 4111111111111111');
    expect(result).not.toContain('4111111111111111');
    expect(result).toContain(BRACKET);
  });

  it('redacts card number with spaces', () => {
    const result = redact('Payment card: 4111 1111 1111 1111');
    expect(result).not.toContain('4111 1111 1111 1111');
  });

  it('redacts card number with dashes', () => {
    const result = redact('Card no.: 5500-0000-0000-0004');
    expect(result).not.toContain('5500-0000-0000-0004');
  });
});

// ---------------------------------------------------------------------------
// Aadhaar number detection
// ---------------------------------------------------------------------------

describe('Aadhaar number redaction', () => {
  it('redacts 12-digit Aadhaar without spaces', () => {
    const result = redact('Aadhaar: 234567890123');
    expect(result).not.toContain('234567890123');
    expect(result).toContain(BRACKET);
  });

  it('redacts Aadhaar formatted with spaces (2 3 4 5 6 7 8 9 0 1 2 3)', () => {
    const result = redact('UID: 2345 6789 0123');
    expect(result).not.toContain('2345 6789 0123');
  });
});

// ---------------------------------------------------------------------------
// PAN number detection
// ---------------------------------------------------------------------------

describe('PAN number redaction', () => {
  it('redacts a valid PAN in uppercase', () => {
    const result = redact('PAN: ABCDE1234F');
    expect(result).not.toContain('ABCDE1234F');
    expect(result).toContain(BRACKET);
  });

  it('redacts PAN in a sentence', () => {
    const result = redact('The taxpayer ABCDE1234F has filed returns.');
    expect(result).not.toContain('ABCDE1234F');
  });
});

// ---------------------------------------------------------------------------
// SSN detection
// ---------------------------------------------------------------------------

describe('SSN redaction', () => {
  it('redacts SSN with dashes', () => {
    const result = redact('SSN: 123-45-6789');
    expect(result).not.toContain('123-45-6789');
    expect(result).toContain(BRACKET);
  });

  it('redacts SSN with spaces', () => {
    const result = redact('Social Security: 123 45 6789');
    expect(result).not.toContain('123 45 6789');
  });
});

// ---------------------------------------------------------------------------
// Date of birth detection
// ---------------------------------------------------------------------------

describe('Date of Birth redaction', () => {
  it('redacts DD/MM/YYYY format', () => {
    const result = redact('DOB: 15/08/1990');
    expect(result).not.toContain('15/08/1990');
  });

  it('redacts MM-DD-YYYY format', () => {
    const result = redact('Date of birth: 08-15-1990');
    expect(result).not.toContain('08-15-1990');
  });

  it('redacts YYYY.MM.DD format', () => {
    const result = redact('Born: 1990.08.15');
    expect(result).not.toContain('1990.08.15');
  });
});

// ---------------------------------------------------------------------------
// Postal address detection
// ---------------------------------------------------------------------------

describe('Postal address redaction', () => {
  it('redacts a basic street address', () => {
    const result = redact('Lives at 42 Baker Street, London.');
    expect(result).not.toContain('42 Baker Street');
  });

  it('redacts address with suite/apartment', () => {
    const result = redact('Address: 100 Main Avenue, Suite 200');
    expect(result).not.toContain('100 Main Avenue');
  });
});

// ---------------------------------------------------------------------------
// Multiple PII types in same text
// ---------------------------------------------------------------------------

describe('Multiple PII types in same text', () => {
  it('redacts email, phone, and SSN in one pass', () => {
    const text =
      'Contact john@acme.com or call 555-867-5309. SSN: 123-45-6789.';
    const result = redact(text);
    expect(result).not.toContain('john@acme.com');
    expect(result).not.toContain('555-867-5309');
    expect(result).not.toContain('123-45-6789');
  });

  it('handles overlapping-style patterns without crashing', () => {
    const text = 'DOB: 01/01/1990, SSN 123-45-6789, email: a@b.com';
    expect(() => redact(text)).not.toThrow();
    const result = redact(text);
    expect(result).not.toContain('@');
  });

  it('preserves non-PII surrounding text', () => {
    const text = 'Parties agree that email user@test.com is the contact point.';
    const result = redact(text);
    expect(result).toContain('Parties agree that email');
    expect(result).toContain('is the contact point.');
  });
});

// ---------------------------------------------------------------------------
// Large document smoke test
// ---------------------------------------------------------------------------

describe('Large document performance', () => {
  it('processes a 10 000-word document without timeout', () => {
    const paragraph =
      'This agreement is between John Doe (john.doe@example.com, SSN 123-45-6789) ' +
      'and Jane Smith (+91 9876543210). Payment card 4111 1111 1111 1111.\n';
    const largeText = paragraph.repeat(500); // ~10 000 words

    const start = performance.now();
    const result = redact(largeText);
    const elapsed = performance.now() - start;

    expect(result).not.toContain('john.doe@example.com');
    expect(result).not.toContain('9876543210');
    // Should complete in well under 5 seconds on any modern CPU
    expect(elapsed).toBeLessThan(5000);
  });
});

// ---------------------------------------------------------------------------
// Extensibility — custom patterns
// ---------------------------------------------------------------------------

describe('Custom pattern extensibility', () => {
  it('accepts a custom pattern list and applies it', () => {
    const customPatterns: PiiPattern[] = [
      {
        label: 'CUSTOM_ID',
        pattern: /CASE-\d{6}/g,
      },
    ];

    const result = redact('File reference CASE-123456 has been closed.', 'bracket', customPatterns);
    expect(result).not.toContain('CASE-123456');
    expect(result).toContain(BRACKET);
  });

  it('does not apply default patterns when custom list is provided', () => {
    const customPatterns: PiiPattern[] = [
      {
        label: 'CUSTOM_ID',
        pattern: /CASE-\d{6}/g,
      },
    ];

    // Email should NOT be redacted because it's not in the custom list
    const text = 'user@example.com and CASE-123456';
    const result = redact(text, 'bracket', customPatterns);
    expect(result).toContain('user@example.com');
    expect(result).not.toContain('CASE-123456');
  });
});

// ---------------------------------------------------------------------------
// findPiiMatches()
// ---------------------------------------------------------------------------

describe('findPiiMatches()', () => {
  it('returns empty array for clean text', () => {
    const matches = findPiiMatches('This is clean text.');
    expect(matches).toEqual([]);
  });

  it('returns matches with correct labels', () => {
    const matches = findPiiMatches('Email me at test@example.com');
    const emailMatch = matches.find((m) => m.label === 'EMAIL');
    expect(emailMatch).toBeDefined();
    expect(emailMatch?.match).toContain('@');
  });

  it('returns matches sorted by position', () => {
    const text = 'Call +91 9876543210 or email user@test.com';
    const matches = findPiiMatches(text);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].index).toBeGreaterThanOrEqual(matches[i - 1].index);
    }
  });

  it('handles empty string', () => {
    expect(findPiiMatches('')).toEqual([]);
  });

  it('finds all PII_PATTERNS labels that are present', () => {
    const text =
      'SSN 123-45-6789 and email x@y.com and card 4111111111111111';
    const matches = findPiiMatches(text);
    const labels = matches.map((m) => m.label);
    expect(labels).toContain('SSN');
    expect(labels).toContain('EMAIL');
    expect(labels).toContain('CREDIT_CARD');
  });
});

// ---------------------------------------------------------------------------
// PII_PATTERNS export
// ---------------------------------------------------------------------------

describe('PII_PATTERNS array', () => {
  it('exports an array of pattern objects', () => {
    expect(Array.isArray(PII_PATTERNS)).toBe(true);
    expect(PII_PATTERNS.length).toBeGreaterThan(0);
  });

  it('every pattern has a label and a RegExp with global flag', () => {
    PII_PATTERNS.forEach(({ label, pattern }) => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
      expect(pattern).toBeInstanceOf(RegExp);
      expect(pattern.flags).toContain('g');
    });
  });
});
