/**
 * DocumentCompareSelector
 *
 * Renders a floating action bar that appears when the user has selected one
 * or more documents in the Document Vault for cross-document comparison.
 *
 * Responsibilities:
 *   - Show the count of selected documents.
 *   - Disable the "Compare" button when fewer than 2 are selected.
 *   - Show per-document chip badges so the user can see / deselect individual items.
 *   - Provide a "Clear" control to deselect all.
 *   - Fire `onCompare(selectedIds)` when the user confirms.
 *
 * This component is intentionally stateless — selection state lives in the
 * parent (`DocumentsPage`) so it can also be used to pre-populate the chat
 * session when navigating to ChatbotPage.
 */

import { X, GitCompare, CheckCircle2 } from 'lucide-react';
import { Document } from '../services/storage';

interface DocumentCompareSelectorProps {
  /** All documents currently in the vault (used to resolve names from IDs). */
  allDocuments: Document[];
  /** Array of selected document IDs. */
  selectedIds: string[];
  /** Called when the user toggles a document's selection state. */
  onToggle: (id: string) => void;
  /** Called to clear all selections. */
  onClear: () => void;
  /** Called when the user clicks "Compare Documents". */
  onCompare: (ids: string[]) => void;
}

export function DocumentCompareSelector({
  allDocuments,
  selectedIds,
  onToggle,
  onClear,
  onCompare,
}: DocumentCompareSelectorProps) {
  const count = selectedIds.length;
  const canCompare = count >= 2;

  // Resolve selected documents for chip display (skip unknown IDs gracefully)
  const selectedDocs = selectedIds
    .map(id => allDocuments.find(d => d.id === id))
    .filter((d): d is Document => d !== undefined);

  if (count === 0) return null;

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl
                 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700
                 shadow-2xl shadow-black/10 dark:shadow-black/40 p-4 animate-slide-up"
      role="region"
      aria-label="Document comparison selection bar"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">

        {/* Left — selection count + chips */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Count badge */}
          <span
            className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
              canCompare
                ? 'bg-primary-600/10 text-primary border-primary-600/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}
          >
            <CheckCircle2 size={12} />
            {count} selected
          </span>

          {/* Document chips */}
          <div className="flex flex-wrap gap-1.5 min-w-0">
            {selectedDocs.map(doc => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold
                           bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300
                           border border-gray-200 dark:border-gray-700 max-w-[160px]"
              >
                <span className="truncate">{doc.name}</span>
                <button
                  onClick={() => onToggle(doc.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors ml-0.5"
                  aria-label={`Remove ${doc.name} from selection`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>

          {/* Minimum 2 hint */}
          {!canCompare && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              Select at least 2 to compare
            </span>
          )}
        </div>

        {/* Right — action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onClear}
            className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400
                       hover:text-gray-800 dark:hover:text-gray-200 transition-colors rounded-lg
                       hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Clear all document selections"
          >
            Clear all
          </button>

          <button
            onClick={() => onCompare(selectedIds)}
            disabled={!canCompare}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl
                       transition-all active:scale-95 ${
                         canCompare
                           ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/20 hover:scale-[1.02]'
                           : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                       }`}
            aria-disabled={!canCompare}
            aria-label={
              canCompare
                ? `Compare ${count} selected documents`
                : 'Select at least 2 documents to compare'
            }
          >
            <GitCompare size={14} />
            Compare Documents
          </button>
        </div>

      </div>
    </div>
  );
}
