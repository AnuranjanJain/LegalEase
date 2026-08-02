import React, { useState } from 'react';
import { 
  Zap, Users, Calendar, DollarSign, AlertOctagon, 
  CheckCircle2, ChevronRight, ChevronLeft, Sparkles, RefreshCcw 
} from 'lucide-react';
import { TldrData } from '../services/storage';

interface TldrSidebarProps {
  tldr?: TldrData | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
  isCollapsible?: boolean;
  defaultOpen?: boolean;
}

export const TldrSidebar: React.FC<TldrSidebarProps> = ({
  tldr,
  isLoading = false,
  onRefresh,
  className = '',
  isCollapsible = true,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const parties = tldr?.parties || 'Not specified';
  const deadlines = tldr?.deadlines || 'Not specified';
  const financials = tldr?.financials || 'Not specified';
  const penalties = tldr?.penalties || 'Not specified';
  const takeaways = tldr?.key_takeaways && tldr.key_takeaways.length > 0 
    ? tldr.key_takeaways 
    : ['Not specified'];

  const renderValue = (val: string, badgeBg = 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300') => {
    if (!val || val === 'Not specified') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 italic border border-gray-200 dark:border-gray-800">
          Not specified
        </span>
      );
    }
    return (
      <p className={`text-xs font-medium leading-relaxed ${badgeBg}`}>
        {val}
      </p>
    );
  };

  return (
    <aside 
      className={`relative transition-all duration-300 ${className}`}
      data-testid="tldr-sidebar"
    >
      {/* Container Box */}
      <div className="h-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-150 dark:border-gray-850 bg-gradient-to-r from-primary-500/10 via-primary-600/5 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-600 text-white shadow-md shadow-primary-500/20 flex-shrink-0 animate-pulse">
              <Zap size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white tracking-wide uppercase">
                  TL;DR Quick Facts
                </h3>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Sparkles size={9} />
                  AI Facts
                </span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                Key critical points extracted at a glance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                title="Regenerate Quick Facts"
                className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                aria-label="Refresh TL;DR facts"
              >
                <RefreshCcw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
            )}

            {isCollapsible && (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={isOpen ? "Collapse TL;DR sidebar" : "Expand TL;DR sidebar"}
              >
                {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        {isOpen && (
          <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh] scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
            {isLoading ? (
              <div className="py-8 text-center space-y-3">
                <RefreshCcw size={24} className="mx-auto text-primary animate-spin" />
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Extracting key legal data points...
                </p>
              </div>
            ) : (
              <>
                {/* 1. Parties Involved */}
                <div className="p-3 rounded-xl bg-gray-50/70 dark:bg-gray-950/40 border border-gray-150 dark:border-gray-850/80 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400">
                    <Users size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      Parties Involved
                    </span>
                  </div>
                  {renderValue(parties, 'text-gray-800 dark:text-gray-200 font-semibold')}
                </div>

                {/* 2. Deadlines & Dates */}
                <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/5 border border-amber-500/15 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Calendar size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      Deadlines & Dates
                    </span>
                  </div>
                  {renderValue(deadlines, 'text-amber-950 dark:text-amber-200')}
                </div>

                {/* 3. Financials & Fees */}
                <div className="p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/15 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <DollarSign size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      Financials & Fees
                    </span>
                  </div>
                  {renderValue(financials, 'text-emerald-950 dark:text-emerald-200')}
                </div>

                {/* 4. Penalties & Risks */}
                <div className="p-3 rounded-xl bg-red-500/5 dark:bg-red-500/5 border border-red-500/15 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <AlertOctagon size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      Penalties & Liabilities
                    </span>
                  </div>
                  {renderValue(penalties, 'text-red-950 dark:text-red-200')}
                </div>

                {/* 5. Key Action Takeaways */}
                <div className="p-3 rounded-xl bg-blue-500/5 dark:bg-blue-500/5 border border-blue-500/15 space-y-2">
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <CheckCircle2 size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      Key Takeaways
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {takeaways.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300 leading-snug">
                        <span className="text-primary mt-0.5">•</span>
                        {item === 'Not specified' ? (
                          <span className="italic text-gray-400 dark:text-gray-500">Not specified</span>
                        ) : (
                          <span>{item}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
