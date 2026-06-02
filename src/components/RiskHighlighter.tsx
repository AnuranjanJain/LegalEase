import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { api } from '../services/api';

type RiskLevel = 'high' | 'medium' | 'low';

interface ClauseRisk {
  clause_id: number;
  text: string;
  risk_level: RiskLevel;
  risk_score: number;
  category: string;
  explanation: string;
  matched_patterns: string[];
  start_offset: number;
  end_offset: number;
}

interface RiskAssessment {
  total_clauses: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  overall_risk_score: number;
  clauses: ClauseRisk[];
  categories_found: string[];
}

interface Props {
  documentText: string;
  onClauseClick?: (clause: ClauseRisk) => void;
}

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; border: string; icon: typeof AlertTriangle; label: string }> = {
  high: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    icon: AlertTriangle,
    label: '🔴 High Risk',
  },
  medium: {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    icon: AlertCircle,
    label: '🟡 Medium Risk',
  },
  low: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle,
    label: '🟢 Low Risk',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  liability: 'Liability',
  termination: 'Termination',
  penalty: 'Penalty',
  financial: 'Financial',
  restrictive: 'Restrictive',
  ip_rights: 'IP Rights',
  data_privacy: 'Data Privacy',
  legal_rights: 'Legal Rights',
  ambiguous: 'Ambiguous Language',
  confidentiality: 'Confidentiality',
  modification: 'Modification',
  standard: 'Standard',
  general: 'General',
};

export default function RiskHighlighter({ documentText, onClauseClick }: Props) {
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RiskLevel | 'all'>('all');
  const [expandedClauses, setExpandedClauses] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const runAssessment = async () => {
    if (!documentText?.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<RiskAssessment>('/legal/risk-assess', {
        text: documentText,
        max_clauses: 100,
      });
      setAssessment(result);
      // Auto-expand high-risk clauses
      const highRiskIds = new Set(
        result.clauses.filter(c => c.risk_level === 'high').map(c => c.clause_id)
      );
      setExpandedClauses(highRiskIds);
    } catch (e: any) {
      setError(e?.message || 'Failed to assess document risk');
    } finally {
      setLoading(false);
    }
  };

  const toggleClause = (id: number) => {
    setExpandedClauses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredClauses = assessment?.clauses.filter(c => 
    filter === 'all' || c.risk_level === filter
  ) || [];

  const displayedClauses = showAll ? filteredClauses : filteredClauses.slice(0, 20);

  const getOverallRiskLabel = (score: number): { label: string; color: string } => {
    if (score >= 0.5) return { label: 'High Risk', color: 'text-red-600 dark:text-red-400' };
    if (score >= 0.3) return { label: 'Medium Risk', color: 'text-amber-600 dark:text-amber-400' };
    return { label: 'Low Risk', color: 'text-emerald-600 dark:text-emerald-400' };
  };

  if (!assessment && !loading && !error) {
    return (
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="text-primary-600 dark:text-primary-400" size={20} />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Clause Risk Analysis
            </span>
          </div>
          <button
            onClick={runAssessment}
            disabled={!documentText?.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50 transition-all"
          >
            Analyze Risks
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Identify potentially risky clauses in your document with color-coded risk levels.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/30">
        <div className="flex items-center gap-2">
          <Shield className="text-primary-600 animate-pulse" size={20} />
          <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
            Analyzing document risks...
          </span>
        </div>
        <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-primary-600 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-red-500" size={20} />
          <span className="text-sm font-semibold text-red-700 dark:text-red-300">
            Risk Analysis Failed
          </span>
        </div>
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
        <button
          onClick={runAssessment}
          className="text-xs mt-2 px-3 py-1 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!assessment) return null;

  const overallRisk = getOverallRiskLabel(assessment.overall_risk_score);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/75 dark:bg-gray-950/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="text-primary-600 dark:text-primary-400" size={20} />
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              Risk Assessment Summary
            </span>
          </div>
          <span className={`text-sm font-bold ${overallRisk.color}`}>
            {overallRisk.label} ({assessment.overall_risk_score.toFixed(2)})
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(['high', 'medium', 'low'] as RiskLevel[]).map(level => {
            const config = RISK_CONFIG[level];
            const count = level === 'high' ? assessment.high_risk_count :
                         level === 'medium' ? assessment.medium_risk_count :
                         assessment.low_risk_count;
            return (
              <button
                key={level}
                onClick={() => setFilter(filter === level ? 'all' : level)}
                className={`p-3 rounded-lg border transition-all ${
                  filter === level
                    ? `${config.bg} ${config.border} ring-2 ring-offset-1 ring-${level === 'high' ? 'red' : level === 'medium' ? 'amber' : 'emerald'}-400`
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className={`text-lg font-bold ${config.color}`}>{count}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {config.label}
                </div>
              </button>
            );
          })}
        </div>

        {assessment.categories_found.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {assessment.categories_found.map(cat => (
              <span
                key={cat}
                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              >
                {CATEGORY_LABELS[cat] || cat}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Clause List */}
      {displayedClauses.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {filter === 'all' ? 'All' : RISK_CONFIG[filter].label} Clauses ({filteredClauses.length})
            </span>
            <div className="flex items-center gap-2">
              <Filter size={12} className="text-gray-400" />
              <select
                value={filter}
                onChange={e => setFilter(e.target.value as RiskLevel | 'all')}
                className="text-xs bg-transparent border-none text-gray-500 dark:text-gray-400 focus:ring-0"
              >
                <option value="all">All</option>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
          </div>

          {displayedClauses.map(clause => {
            const config = RISK_CONFIG[clause.risk_level];
            const Icon = config.icon;
            const isExpanded = expandedClauses.has(clause.clause_id);

            return (
              <div
                key={clause.clause_id}
                className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden transition-all`}
              >
                <button
                  onClick={() => toggleClause(clause.clause_id)}
                  className="w-full p-3 text-left flex items-start gap-2 hover:opacity-90 transition-opacity"
                >
                  <Icon className={`${config.color} flex-shrink-0 mt-0.5`} size={16} />
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        Clause #{clause.clause_id}
                        <span className="ml-2 text-[10px] font-normal text-gray-500">
                          {CATEGORY_LABELS[clause.category] || clause.category}
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${config.color}`}>
                          {(clause.risk_score * 100).toFixed(0)}%
                        </span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                    {!isExpanded && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {clause.text}
                      </p>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-200/50 dark:border-gray-700/50">
                    <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                      {clause.text}
                    </div>
                    <div className={`text-xs ${config.color} font-medium`}>
                      ⚠ {clause.explanation}
                    </div>
                    {onClauseClick && (
                      <button
                        onClick={() => onClauseClick(clause)}
                        className="text-xs px-2 py-1 rounded bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800"
                      >
                        View in Document
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredClauses.length > 20 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-xs py-2 text-center text-primary-600 dark:text-primary-400 hover:underline"
            >
              Show all {filteredClauses.length} clauses
            </button>
          )}
        </div>
      )}
    </div>
  );
}
