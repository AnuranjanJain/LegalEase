/**
 * useRedactedText
 *
 * A memoized hook that returns either the original text or its redacted
 * version depending on the current global redaction toggle state.
 *
 * Usage:
 *   const displayText = useRedactedText(rawText);
 *
 * The hook reads `isRedactionEnabled` and `redactionStyle` from
 * RedactionContext, so no props need to be threaded through the component
 * tree manually.
 *
 * Performance:
 *   useMemo ensures the expensive regex pass only re-runs when the source
 *   text, the toggle state, or the style actually changes.
 */

import { useMemo } from 'react';
import { useRedaction } from '../contexts/RedactionContext';
import { redact } from '../utils/redaction';

/**
 * @param text - The original, unredacted text. May be undefined/null.
 * @returns    The text to display: either the original or a redacted copy.
 */
export function useRedactedText(text: string | undefined | null): string {
  const { isRedactionEnabled, redactionStyle } = useRedaction();

  return useMemo(() => {
    if (!text) return text ?? '';
    if (!isRedactionEnabled) return text;
    return redact(text, redactionStyle);
  }, [text, isRedactionEnabled, redactionStyle]);
}
