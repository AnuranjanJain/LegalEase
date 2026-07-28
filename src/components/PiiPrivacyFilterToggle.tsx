import { ShieldCheck, Eye, Lock } from 'lucide-react';
import { useRedaction } from '../contexts/RedactionContext';

interface PiiPrivacyFilterToggleProps {
  id?: string;
  className?: string;
  showDetails?: boolean;
}

export function PiiPrivacyFilterToggle({
  id = 'auto-redact-toggle',
  className = '',
  showDetails = true,
}: PiiPrivacyFilterToggleProps) {
  const { isRedactionEnabled, toggleRedaction } = useRedaction();

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 ${
      isRedactionEnabled 
        ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' 
        : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30'
    } ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg flex-shrink-0 ${
            isRedactionEnabled
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                Auto-Redact Sensitive Info (Privacy Filter)
              </h4>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                isRedactionEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 animate-pulse'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-700'
              }`}>
                {isRedactionEnabled ? 'Active' : 'Off'}
              </span>
            </div>
            {showDetails && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Automatically sanitizes Emails, Phone numbers, SSNs, Aadhaar, PAN & IDs client-side before sending.
              </p>
            )}
          </div>
        </div>

        <button
          id={id}
          role="switch"
          aria-checked={isRedactionEnabled}
          aria-label="Auto-Redact Sensitive Info"
          onClick={toggleRedaction}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
            isRedactionEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
              isRedactionEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {isRedactionEnabled && showDetails && (
        <div className="mt-3 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-300">
          <span className="flex items-center gap-1.5 font-medium">
            <Lock size={12} />
            Client-side redaction ensures PII never hits the backend server.
          </span>
          <span className="flex items-center gap-1 text-[10px] font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <Eye size={10} /> Live Preview Ready
          </span>
        </div>
      )}
    </div>
  );
}
