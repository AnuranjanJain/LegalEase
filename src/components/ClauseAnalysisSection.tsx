import { ClauseAnalysis } from '../services/storage';

interface ClauseAnalysisSectionProps {
  clauses?: ClauseAnalysis[];
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
        {clauses.map((item, idx) => {
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
              key={idx} 
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
                {item.riskReason}
              </div>
              {item.clause && (
                <div className="mt-2 pl-3 border-l-2 border-gray-300 dark:border-gray-700 text-gray-650 dark:text-gray-400 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50/50 dark:bg-gray-900/40 p-2 rounded">
                  {item.clause}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
