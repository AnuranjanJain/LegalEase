import React, { useState, useRef, useEffect, useId } from 'react';
import legaleseDictionary from '../data/legaleseDictionary.json';

export type DictionaryMap = Record<string, string>;

interface LegaleseSimplifierProps {
  /** The text string to parse for legal terms */
  text: string;
  /** Optional custom dictionary overriding or extending defaults */
  dictionary?: DictionaryMap;
  /** Optional container CSS class */
  className?: string;
  /** Optional term underline CSS class override */
  termClassName?: string;
}

// Compile a case-insensitive regex pattern from dictionary keys sorted by length (descending)
// so multi-word terms like "Statute of Limitations" match before single-word "Statute".
function buildRegexPattern(dict: DictionaryMap): RegExp | null {
  const keys = Object.keys(dict);
  if (keys.length === 0) return null;

  // Escape special regex characters in dictionary keys if any
  const escapedKeys = keys
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return new RegExp(`\\b(${escapedKeys.join('|')})\\b`, 'gi');
}

/**
 * LegaleseTermTooltip
 * Renders an individual legalese term with a dashed underline and accessible interactive tooltip.
 * Supports hover, click/tap (mobile), and keyboard navigation (Tab, Enter, Space, Escape).
 */
function LegaleseTermTooltip({
  matchedText,
  dictionaryKey,
  definition,
  customTermClassName,
}: {
  matchedText: string;
  dictionaryKey: string;
  definition: string;
  customTermClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  // Close tooltip on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleTooltip = () => {
    setIsOpen((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTooltip();
    }
  };

  return (
    <span
      ref={containerRef}
      className="relative inline-block group cursor-help"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        onClick={toggleTooltip}
        onKeyDown={handleKeyDown}
        className={
          customTermClassName ||
          'underline decoration-dashed decoration-primary underline-offset-4 decoration-2 font-medium text-primary dark:text-primary-light hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors px-0.5 rounded focus:outline-none focus:ring-2 focus:ring-primary/40'
        }
      >
        {matchedText}
      </span>

      {isOpen && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 text-xs font-normal text-left text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
        >
          <span className="block font-semibold text-primary dark:text-primary-light mb-1 text-sm border-b border-gray-100 dark:border-gray-700 pb-1">
            {dictionaryKey}
          </span>
          <span className="block text-gray-600 dark:text-gray-300 leading-relaxed">
            {definition}
          </span>
          {/* Tooltip caret arrow */}
          <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-gray-800" />
        </span>
      )}
    </span>
  );
}

/**
 * LegaleseSimplifier
 * Main text-parsing component that scans prose for legal terms and injects tooltips.
 */
export function LegaleseSimplifier({
  text,
  dictionary = legaleseDictionary as DictionaryMap,
  className,
  termClassName,
}: LegaleseSimplifierProps) {
  if (!text) return null;

  const regex = buildRegexPattern(dictionary);
  if (!regex) return <span className={className}>{text}</span>;

  // Build key mapping lookup (case-insensitive)
  const keyLookup: Record<string, { key: string; def: string }> = {};
  Object.entries(dictionary).forEach(([k, v]) => {
    keyLookup[k.toLowerCase()] = { key: k, def: v };
  });

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Global regex iteration over input text
  regex.lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;
    const matchedStr = match[0];

    // Push preceding non-matched text segment
    if (matchStart > lastIndex) {
      parts.push(text.slice(lastIndex, matchStart));
    }

    const entry = keyLookup[matchedStr.toLowerCase()];
    if (entry) {
      parts.push(
        <LegaleseTermTooltip
          key={`${matchStart}-${matchedStr}`}
          matchedText={matchedStr}
          dictionaryKey={entry.key}
          definition={entry.def}
          customTermClassName={termClassName}
        />
      );
    } else {
      parts.push(matchedStr);
    }

    lastIndex = matchEnd;
  }

  // Push remaining trailing text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}

export default LegaleseSimplifier;
