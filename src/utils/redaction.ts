/**
 * PII Redaction Utility
 *
 * Detects and redacts Personally Identifiable Information (PII) from text.
 * Patterns are intentionally kept as an ordered, extensible array so new
 * pattern types can be added without touching the core redact() function.
 *
 * Architecture:
 *  - Original text is NEVER mutated.
 *  - redact() is a pure function: same input always produces same output.
 *  - Each pattern carries a human-readable `label` for future audit logging.
 */

export type RedactionStyle = 'bracket' | 'block' | 'labeled';

export interface PiiPattern {
  /** Human-readable identifier, e.g. "EMAIL" */
  label: string;
  /** Regex used to find PII. Must use the `g` (global) flag. */
  pattern: RegExp;
}

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

/**
 * Core PII patterns.
 *
 * Ordering matters when patterns can overlap; more-specific patterns should
 * appear before more-general ones. All patterns must have the `g` flag.
 */
export const PII_PATTERNS: PiiPattern[] = [
  // ── Financial identifiers ──────────────────────────────────────────────
  {
    label: 'CREDIT_CARD',
    // 13–19 digit card numbers, optional spaces/dashes between groups
    pattern:
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|(?:5[1-5][0-9]{14})|(?:3[47][0-9]{13})|(?:3(?:0[0-5]|[68][0-9])[0-9]{11})|(?:6(?:011|5[0-9]{2})[0-9]{12})|(?:(?:2131|1800|35\d{3})\d{11}))\b|(?:\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{2,4})/g,
  },
  {
    label: 'BANK_ACCOUNT',
    // Generic 8–18 digit account numbers preceded by account-related keywords
    pattern:
      /\b(?:account\s*(?:number|no\.?|#)\s*[:=]?\s*)[0-9]{8,18}\b|\b[0-9]{8,18}\s*(?:account|a\/c|acc)\b/gi,
  },

  // ── Government / national identifiers ─────────────────────────────────
  {
    label: 'SSN',
    // US Social Security Number — dashes or spaces as separators
    pattern: /\b(?!000|666|9\d{2})\d{3}[\s-](?!00)\d{2}[\s-](?!0000)\d{4}\b/g,
  },
  {
    label: 'AADHAAR',
    // 12-digit Aadhaar — may be written with spaces every 4 digits
    pattern: /\b[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/g,
  },
  {
    label: 'PAN',
    // India PAN card: 5 letters, 4 digits, 1 letter (case-insensitive)
    pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/gi,
  },

  // ── Contact information ────────────────────────────────────────────────
  {
    label: 'EMAIL',
    pattern:
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    label: 'PHONE',
    // International (+XX) and local formats, including Indian 10-digit numbers
    pattern:
      /(?:\+?(\d{1,3})[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{4,6}(?:\s?(?:ext|x)\s?\d{1,5})?/g,
  },

  // ── Dates of birth ────────────────────────────────────────────────────
  {
    label: 'DATE_OF_BIRTH',
    // Common formats: DD/MM/YYYY, MM-DD-YYYY, YYYY.MM.DD, "born on …", etc.
    pattern:
      /\b(?:born\s+(?:on\s+)?|dob[:\s]+|date\s+of\s+birth[:\s]+)?(?:0?[1-9]|[12]\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}\b|\b(?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\d|3[01])[/.-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[/.-](?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\d|3[01])\b/gi,
  },

  // ── Physical addresses ────────────────────────────────────────────────
  {
    label: 'POSTAL_ADDRESS',
    // Matches "123 Main Street", "Apt 4B", "Suite 100", etc.
    pattern:
      /\b\d{1,5}\s+(?:[A-Za-z0-9]+\s){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Terrace|Ter|Crescent|Cres)\b(?:\s*,?\s*(?:Apt|Apartment|Suite|Ste|Unit|#)\s*[A-Za-z0-9-]+)?/gi,
  },
  {
    label: 'ZIP_CODE',
    // US ZIP (5-digit or ZIP+4) and Indian PIN codes (6-digit starting 1–9)
    pattern: /\b\d{5}(?:-\d{4})?\b|\b[1-9][0-9]{5}\b/g,
  },
];

// ---------------------------------------------------------------------------
// Explicit Regex Helper Utility Functions (Acceptance Criteria 1)
// ---------------------------------------------------------------------------

export function isEmail(text: string): boolean {
  const p = PII_PATTERNS.find(item => item.label === 'EMAIL')?.pattern;
  if (!p) return false;
  p.lastIndex = 0;
  return new RegExp(p.source, p.flags.replace('g', '')).test(text);
}

export function isPhone(text: string): boolean {
  const p = PII_PATTERNS.find(item => item.label === 'PHONE')?.pattern;
  if (!p) return false;
  p.lastIndex = 0;
  return new RegExp(p.source, p.flags.replace('g', '')).test(text);
}

export function isSSN(text: string): boolean {
  const p = PII_PATTERNS.find(item => item.label === 'SSN')?.pattern;
  if (!p) return false;
  p.lastIndex = 0;
  return new RegExp(p.source, p.flags.replace('g', '')).test(text);
}

export function isAadhaar(text: string): boolean {
  const p = PII_PATTERNS.find(item => item.label === 'AADHAAR')?.pattern;
  if (!p) return false;
  p.lastIndex = 0;
  return new RegExp(p.source, p.flags.replace('g', '')).test(text);
}

export function isPAN(text: string): boolean {
  const p = PII_PATTERNS.find(item => item.label === 'PAN')?.pattern;
  if (!p) return false;
  p.lastIndex = 0;
  return new RegExp(p.source, p.flags.replace('g', '')).test(text);
}

// ---------------------------------------------------------------------------
// Redaction token helpers
// ---------------------------------------------------------------------------

const BRACKET_TOKEN = '[REDACTED]';
const BLOCK_TOKEN = '██████████';

/**
 * Returns the replacement token for the given style and optional pattern label.
 */
export function getRedactionToken(style: RedactionStyle = 'bracket', label?: string): string {
  if (style === 'block') return BLOCK_TOKEN;
  if (style === 'labeled' && label) return `[REDACTED_${label}]`;
  return BRACKET_TOKEN;
}

// ---------------------------------------------------------------------------
// Core redaction function
// ---------------------------------------------------------------------------

/**
 * Redacts all PII detected in `text` and returns the sanitised string.
 *
 * @param text  - Input string (never mutated).
 * @param style - Replacement token style ('bracket' = "[REDACTED]",
 *                'block' = "██████████", 'labeled' = "[REDACTED_EMAIL]"). Defaults to 'bracket'.
 * @param patterns - PII pattern list to apply. Defaults to `PII_PATTERNS`.
 * @param useLabeledPlaceholders - If true, replaces each PII type with a specific placeholder e.g. [REDACTED_EMAIL].
 * @returns A new string with all detected PII replaced.
 */
export function redact(
  text: string,
  style: RedactionStyle = 'bracket',
  patterns: PiiPattern[] = PII_PATTERNS,
  useLabeledPlaceholders = false
): string {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  for (const { label, pattern } of patterns) {
    // Reset lastIndex so re-used regex objects work correctly across calls
    pattern.lastIndex = 0;
    const token = useLabeledPlaceholders || style === 'labeled'
      ? `[REDACTED_${label}]`
      : getRedactionToken(style, label);
    result = result.replace(pattern, token);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Utility: count PII matches in text (useful for auditing/testing)
// ---------------------------------------------------------------------------

export interface PiiMatch {
  label: string;
  match: string;
  index: number;
}

/**
 * Returns an array of all PII matches found in the text, with their label
 * and position. Useful for testing and future audit-log features.
 */
export function findPiiMatches(
  text: string,
  patterns: PiiPattern[] = PII_PATTERNS
): PiiMatch[] {
  if (!text || typeof text !== 'string') return [];

  const matches: PiiMatch[] = [];

  for (const { label, pattern } of patterns) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    // Clone pattern to avoid mutating lastIndex in the shared array
    const cloned = new RegExp(pattern.source, pattern.flags);
    while ((m = cloned.exec(text)) !== null) {
      matches.push({ label, match: m[0], index: m.index });
    }
  }

  // Sort by position in text for deterministic output
  return matches.sort((a, b) => a.index - b.index);
}

/**
 * Redacts PII in text and returns detailed feedback metadata for UI components.
 * Real-time visual feedback helper (Acceptance Criteria 3).
 */
export function redactWithFeedback(
  text: string,
  style: RedactionStyle = 'labeled',
  patterns: PiiPattern[] = PII_PATTERNS
): {
  redactedText: string;
  matchCount: number;
  matches: PiiMatch[];
  matchSummary: Record<string, number>;
} {
  if (!text || typeof text !== 'string') {
    return { redactedText: '', matchCount: 0, matches: [], matchSummary: {} };
  }

  const matches = findPiiMatches(text, patterns);
  const redactedText = redact(text, style, patterns, style === 'labeled');

  const matchSummary: Record<string, number> = {};
  matches.forEach(m => {
    matchSummary[m.label] = (matchSummary[m.label] || 0) + 1;
  });

  return {
    redactedText,
    matchCount: matches.length,
    matches,
    matchSummary,
  };
}
