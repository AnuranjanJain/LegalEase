/**
 * RedactedText
 *
 * Renders a string that may contain redaction tokens ([REDACTED] or
 * ██████████) with authentic legal-redaction styling applied to each token:
 *   - Black background
 *   - Black text (invisible inside the badge — genuine ink-blot appearance)
 *   - Rounded corners
 *   - Accessible aria-label="redacted" on every token span
 *
 * Non-token segments are rendered as plain inline text so surrounding prose
 * remains fully readable.
 *
 * Usage:
 *   <RedactedText text={displayText} />
 *
 * The component is intentionally presentation-only — it does NOT call
 * redact() itself. Always pass pre-redacted text produced by useRedactedText
 * or redact() so the redaction logic stays in one place.
 */

import React from 'react';

// The two tokens that redact() can produce.
const BRACKET_TOKEN = '[REDACTED]';
const BLOCK_TOKEN = '██████████';

// Regex that splits a string on either token, keeping the delimiter in the
// resulting array so we know which segments need badge styling.
const TOKEN_RE = /(\[REDACTED\]|██████████)/g;

interface RedactedTextProps {
  /** Pre-redacted text produced by redact() or useRedactedText(). */
  text: string;
  /** Additional CSS classes applied to the wrapping element. */
  className?: string;
}

/**
 * Inline span rendered for every redaction token occurrence.
 * Meets Issue #341 visual spec: black bg, black text, rounded corners.
 */
function RedactedSpan({ token }: { token: string }) {
  const isBlock = token === BLOCK_TOKEN;
  return (
    <span
      // Black text on black background = authentic ink-blot redaction look.
      // The boxShadow gives a subtle 1-px border so the shape is perceivable
      // in both light and dark modes without revealing any content.
      className="inline-block align-middle mx-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold
                 tracking-wide leading-none select-none cursor-default"
      style={{
        backgroundColor: '#000000',
        color: '#000000',
        boxShadow: '0 0 0 1px rgba(128,128,128,0.25)',
        // Give block-style tokens a slightly wider appearance
        minWidth: isBlock ? '6rem' : undefined,
      }}
      aria-label="redacted"
      role="img"
      title="This content has been redacted"
    >
      {token}
    </span>
  );
}

/**
 * Splits `text` on redaction tokens and returns an array of React nodes:
 * plain strings for normal text, <RedactedSpan> for each token.
 */
function tokenise(text: string): React.ReactNode[] {
  const parts = text.split(TOKEN_RE);
  return parts.map((part, i) => {
    if (part === BRACKET_TOKEN || part === BLOCK_TOKEN) {
      return <RedactedSpan key={i} token={part} />;
    }
    // Preserve whitespace-pre-wrap behaviour by returning the string as-is.
    return part;
  });
}

export function RedactedText({ text, className }: RedactedTextProps) {
  if (!text) return null;

  // If there are no tokens in the text, render as a simple string — no extra
  // DOM nodes, identical output to the original plain-text render.
  const hasTokens = TOKEN_RE.test(text);
  // Reset lastIndex after the test() call (stateful regex side-effect).
  TOKEN_RE.lastIndex = 0;

  if (!hasTokens) {
    return <>{text}</>;
  }

  return (
    <span className={className} style={{ whiteSpace: 'pre-wrap' }}>
      {tokenise(text)}
    </span>
  );
}
