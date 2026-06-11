import { ClauseAnalysis } from '../services/storage';
import { useRedactedText } from '../hooks/useRedactedText';
import { RedactedText } from './RedactedText';

interface ClauseAnalysisSectionProps {
  clauses?: ClauseAnalysis[];
}

// ---------------------------------------------------------------------------
// Sub-component: renders a single clause card with redaction applied.
//
// Design notes:
//   - idx is intentionally NOT accepted as a prop. The `key` that React needs
//     for reconciliation belongs on the JSX element in the parent's .map(),
//     not inside the component body (where it would be a no-op).
//   - useRedactedText returns the pre-redacted string; RedactedText renders
//     each [REDACTED] / ██████████ token as a styled inline badge.
// ---------------------------------------------------------------------------
function ClauseCard({ item }: { item: ClauseAnalysis }) {
  const redactedClause = useRedactedText(item.clause);
  const redactedReason = useRedactedText(item.riskReason);

  const riskLower = item.riskLevel.toLowerCase();
  const isHigh = riskLower === 'high';
  const isMed = riskLower === 'medium';
  const badgeClass = isHigh
    ? 'bg-red-500/10 text-red-650 dark:text-red-400 border-red-500/20'
    : isMed
    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';

  return (
    <div
      className="p-4 rounded-xl border border-gray-150 dark:border-gray-850 bg-gray-50/30 dark:bg-gray-950/20 space-y-2 text-xs"
      data-testid="clause-card"
    >
      <div className="flex items-center gap-2">
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border tracking-wider ${badgeClass}`}>
          [{item.riskLevel.toUpperCase()} RISK]
        </span>
      </div>
      <div className="text-gray-800 dark:text-gray-300 font-medium">
        <span className="font-bold text-gray-950 dark:text-white">Reason: </span>
        <RedactedText text={redactedReason} />
      </div>
      {item.clause && (
        <div className="mt-2 pl-3 border-l-2 border-gray-300 dark:border-gray-700 text-gray-650 dark:text-gray-400 font-mono leading-relaxed bg-gray-50/50 dark:bg-gray-900/40 p-2 rounded">
          <RedactedText text={redactedClause} />
        </div>
      )}
    </div>
  );
}

export function ClauseAnalysisSection({ clauses }: ClauseAnalysisSectionProps) {
  if (!clauses || clauses.length === 0) {
    return null;
  }

  return (
    <div className="pt-6 border-t border-gray-150 dark:border-gray-850 space-y-4">
      <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
        Clause-Level Risk Assessment
      </h4>
      <div className="space-y-4">
        {/* key is placed here — on the mapped element — not inside ClauseCard */}
        {clauses.map((item, idx) => (
          <ClauseCard key={idx} item={item} />
        ))}
      </div>
    </div>
  );
}
