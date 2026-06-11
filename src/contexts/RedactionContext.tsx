/**
 * RedactionContext
 *
 * Provides a global PII-redaction toggle backed by localStorage so the
 * user's preference survives page refreshes.
 *
 * Architecture decisions:
 *  - Original document content is NEVER altered in storage.
 *  - The toggle only affects the render layer — redacted text is computed
 *    on the fly inside components via `useRedactedText`.
 *  - The context also exposes the chosen `redactionStyle` so users can
 *    switch between "[REDACTED]" (bracket) and "██████████" (block) tokens.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { RedactionStyle } from '../utils/redaction';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RedactionContextType {
  /** Whether PII redaction is currently enabled. Default: false. */
  isRedactionEnabled: boolean;
  /** Visual style of the redaction token. Default: 'bracket'. */
  redactionStyle: RedactionStyle;
  /** Toggle redaction on / off. */
  toggleRedaction: () => void;
  /** Explicitly set redaction enabled state. */
  setRedactionEnabled: (enabled: boolean) => void;
  /** Change the visual redaction token style. */
  setRedactionStyle: (style: RedactionStyle) => void;
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const STORAGE_KEY_ENABLED = 'le_pii_redaction_enabled';
const STORAGE_KEY_STYLE = 'le_pii_redaction_style';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const RedactionContext = createContext<RedactionContextType | undefined>(
  undefined
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function RedactionProvider({ children }: { children: ReactNode }) {
  const [isRedactionEnabled, setIsRedactionEnabledState] = useState<boolean>(
    () => {
      try {
        return localStorage.getItem(STORAGE_KEY_ENABLED) === 'true';
      } catch {
        return false;
      }
    }
  );

  const [redactionStyle, setRedactionStyleState] = useState<RedactionStyle>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_STYLE);
        return saved === 'block' ? 'block' : 'bracket';
      } catch {
        return 'bracket';
      }
    }
  );

  const setRedactionEnabled = useCallback((enabled: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
    } catch {
      // Silently continue if localStorage is unavailable
    }
    setIsRedactionEnabledState(enabled);
  }, []);

  const toggleRedaction = useCallback(() => {
    setIsRedactionEnabledState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_ENABLED, String(next));
      } catch {
        // Silently continue
      }
      return next;
    });
  }, []);

  const setRedactionStyle = useCallback((style: RedactionStyle) => {
    try {
      localStorage.setItem(STORAGE_KEY_STYLE, style);
    } catch {
      // Silently continue
    }
    setRedactionStyleState(style);
  }, []);

  return (
    <RedactionContext.Provider
      value={{
        isRedactionEnabled,
        redactionStyle,
        toggleRedaction,
        setRedactionEnabled,
        setRedactionStyle,
      }}
    >
      {children}
    </RedactionContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRedaction(): RedactionContextType {
  const ctx = useContext(RedactionContext);
  if (!ctx) {
    throw new Error('useRedaction must be used within a RedactionProvider');
  }
  return ctx;
}
