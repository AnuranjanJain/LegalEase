import { ClauseAnalysis } from '../services/storage';

interface DocumentMinimapProps {
  clauses: ClauseAnalysis[];
}

export function DocumentMinimap({ clauses }: DocumentMinimapProps) {
  if (!clauses || clauses.length === 0) return null;

  return (
    <div 
      className="w-4 h-full bg-gray-100 dark:bg-gray-800 rounded-full flex flex-col overflow-hidden shadow-inner shrink-0"
      title="Document Risk Minimap"
    >
      {clauses.map((clause, idx) => {
        const riskLower = clause.riskLevel.toLowerCase();
        let colorClass = 'bg-emerald-400 dark:bg-emerald-500';
        if (riskLower === 'high') colorClass = 'bg-red-500 dark:bg-red-600';
        else if (riskLower === 'medium') colorClass = 'bg-amber-400 dark:bg-amber-500';

        return (
          <div
            key={idx}
            className={`w-full ${colorClass} opacity-80 hover:opacity-100 cursor-help flex-1 transition-all border-b border-white/20 dark:border-gray-900/50`}
            title={`${clause.riskLevel} Risk: ${clause.riskReason}`}
          />
        );
      })}
    </div>
  );
}
