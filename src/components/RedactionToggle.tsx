/**
 * RedactionToggle
 *
 * A self-contained UI component that exposes the PII redaction toggle.
 * Designed to be placed in the Settings page privacy panel but small
 * enough to embed anywhere in the header or toolbar.
 *
 * Styling follows the existing SettingsPage panel aesthetic:
 *  - Glass-morphic card with dark-mode support
 *  - Pill toggle matching the dark-mode toggle style in Header.tsx
 *  - Authentic "legal redaction" appearance for the token preview
 *    (black background, black text, rounded edges)
 */

import { ShieldCheck } from 'lucide-react';
import { useRedaction } from '../contexts/RedactionContext';
import { RedactionStyle } from '../utils/redaction';

// ---------------------------------------------------------------------------
// Sub-component: the animated pill toggle
// ---------------------------------------------------------------------------

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  id: string;
  label: string;
}

function ToggleSwitch({ checked, onChange, id, label }: ToggleSwitchProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        checked
          ? 'bg-primary-600'
          : 'bg-gray-200 dark:bg-gray-700'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: redaction token preview badge
// ---------------------------------------------------------------------------

function RedactionPreviewBadge({ style }: { style: RedactionStyle }) {
  const isBracket = style === 'bracket';
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide select-none"
      style={{
        backgroundColor: '#000000',
        color: '#000000',
        // Slight off-black so the shape is visible in dark mode without
        // revealing any text — pure black text on pure black background
        // gives the authentic legal redaction look.
        boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
      }}
      aria-hidden="true"
      title={`Redaction token: ${isBracket ? '[REDACTED]' : '██████████'}`}
    >
      {isBracket ? '[REDACTED]' : '██████████'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RedactionToggleProps {
  /** Compact mode renders a minimal toggle row without the full card. */
  compact?: boolean;
}

export function RedactionToggle({ compact = false }: RedactionToggleProps) {
  const {
    isRedactionEnabled,
    redactionStyle,
    toggleRedaction,
    setRedactionStyle,
  } = useRedaction();

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck size={16} className="text-primary flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
            PII Redaction
          </span>
          {isRedactionEnabled && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-primary/10 text-primary border border-primary/20">
              ON
            </span>
          )}
        </div>
        <ToggleSwitch
          id="pii-redaction-compact"
          checked={isRedactionEnabled}
          onChange={toggleRedaction}
          label="Toggle PII redaction"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toggle row */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
              Enable PII Redaction
            </p>
            {isRedactionEnabled && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-pulse">
                Active
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            Automatically detects and masks emails, phone numbers, national IDs,
            bank details, addresses, and other PII before displaying any
            document content or AI summaries.
          </p>
        </div>
        <ToggleSwitch
          id="pii-redaction-toggle"
          checked={isRedactionEnabled}
          onChange={toggleRedaction}
          label="Toggle PII redaction"
        />
      </div>

      {/* Style selector — only shown when enabled */}
      {isRedactionEnabled && (
        <div
          className="space-y-3 animate-slide-up"
          aria-label="Redaction token style"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Redaction Token Style
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Bracket style option */}
            <button
              onClick={() => setRedactionStyle('bracket')}
              className={`flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                redactionStyle === 'bracket'
                  ? 'border-primary-600/50 bg-primary-600/5 dark:bg-primary-500/10 ring-1 ring-primary-600/30'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
              aria-pressed={redactionStyle === 'bracket'}
            >
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Bracket
              </span>
              <RedactionPreviewBadge style="bracket" />
              <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                Legal standard notation
              </span>
            </button>

            {/* Block style option */}
            <button
              onClick={() => setRedactionStyle('block')}
              className={`flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                redactionStyle === 'block'
                  ? 'border-primary-600/50 bg-primary-600/5 dark:bg-primary-500/10 ring-1 ring-primary-600/30'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
              aria-pressed={redactionStyle === 'block'}
            >
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Block
              </span>
              <RedactionPreviewBadge style="block" />
              <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                Authentic ink-blot style
              </span>
            </button>
          </div>

          {/* Live demo strip */}
          <div className="p-3 rounded-xl bg-gray-50/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Preview
            </p>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
              Contact{' '}
              <RedactionPreviewBadge style={redactionStyle} />{' '}
              at{' '}
              <RedactionPreviewBadge style={redactionStyle} />{' '}
              or call{' '}
              <RedactionPreviewBadge style={redactionStyle} />.
            </p>
          </div>
        </div>
      )}

      {/* Detected PII types list */}
      <div className="pt-1">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
          Detected PII types
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            'Email',
            'Phone',
            'Credit / Debit Card',
            'Bank Account',
            'Aadhaar',
            'PAN',
            'SSN (US)',
            'Date of Birth',
            'Postal Address',
            'ZIP / PIN Code',
          ].map((label) => (
            <span
              key={label}
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
