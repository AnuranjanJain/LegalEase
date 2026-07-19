import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ClauseAnalysis } from '../services/storage';
import { useRedactedText } from '../hooks/useRedactedText';
import { RedactedText } from './RedactedText';
import { SimplifyModal } from './SimplifyModal';
import { DocumentMinimap } from './DocumentMinimap';

interface ClauseAnalysisSectionProps {
  clauses?: ClauseAnalysis[];
}

// ---------------------------------------------------------------------------
// Sub-component: renders a single clause card with redaction applied.
// ---------------------------------------------------------------------------
function ClauseCard({ item, onSimplify }: { item: ClauseAnalysis; onSimplify: (text: string) => void }) {
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
        {item.liability_score !== undefined && item.liability_score !== null && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            item.liability_score > 75 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
            item.liability_score > 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          }`}>
            Score: {item.liability_score}/100
          </span>
        )}
      </div>
      <div className="text-gray-800 dark:text-gray-300 font-medium">
        <span className="font-bold text-gray-950 dark:text-white">Reason: </span>
        <RedactedText text={redactedReason} />
      </div>
      {item.clause && (
        <div className="mt-2 space-y-2 text-left">
          <div className="pl-3 border-l-2 border-gray-300 dark:border-gray-700 text-gray-650 dark:text-gray-400 font-mono leading-relaxed bg-gray-50/50 dark:bg-gray-900/40 p-2 rounded">
            <RedactedText text={redactedClause} />
          </div>
          <button
            onClick={() => onSimplify(item.clause)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-primary dark:text-primary-400 hover:text-white bg-primary-600/10 hover:bg-primary-600 border border-primary-600/20 hover:border-transparent rounded-lg transition-all"
            aria-label="Simplify clause text"
          >
            <Sparkles size={11} />
            <span>Simplify Clause</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function ClauseAnalysisSection({ clauses }: ClauseAnalysisSectionProps) {
  const [selectedClause, setSelectedClause] = useState<string | null>(null);

  if (!clauses || clauses.length === 0) {
    return null;
  }

  // Calculate average liability score if available
  const scores = clauses.map(c => c.liability_score).filter((s): s is number => s !== undefined && s !== null);
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <div className="pt-6 border-t border-gray-150 dark:border-gray-850 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
          Clause-Level Risk Assessment
        </h4>
        {averageScore !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overall Liability:</span>
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              averageScore > 75 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              averageScore > 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
              'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            }`}>
              {averageScore}/100
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-4 min-h-[200px]">
        {/* Risk Minimap */}
        <DocumentMinimap clauses={clauses} />

        {/* Clauses List */}
        <div className="flex-1 space-y-4 overflow-y-auto pr-2">
          {clauses.map((item, idx) => (
            <ClauseCard key={idx} item={item} onSimplify={setSelectedClause} />
          ))}
        </div>
      </div>

      {selectedClause && (
        <SimplifyModal
          clauseText={selectedClause}
          onClose={() => setSelectedClause(null)}
        />
      )}
    </div>
  );
}

