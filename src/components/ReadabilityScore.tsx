import { useMemo } from 'react';
import { BookOpen, TrendingUp, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { calculateReadability } from '../utils/readability';

export interface ReadabilityScoreProps {
  originalText?: string;
  summaryText?: string;
}

export function ReadabilityScore({ originalText = '', summaryText = '' }: ReadabilityScoreProps) {
  const result = useMemo(() => {
    const cleanedOriginal = originalText.trim();
    const cleanedSummary = summaryText.trim();

    if (!cleanedOriginal || !cleanedSummary) {
      return null;
    }

    try {
      const original = calculateReadability(cleanedOriginal);
      const summary = calculateReadability(cleanedSummary);
      return { original, summary };
    } catch (err) {
      console.warn('Readability calculation failed:', err);
      return null;
    }
  }, [originalText, summaryText]);

  if (!result) {
    return (
      <div 
        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 flex items-center justify-center text-center gap-2"
        role="alert"
        aria-live="polite"
      >
        <AlertCircle size={18} className="text-gray-400 dark:text-gray-500" />
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
          Readability metrics unavailable.
        </span>
      </div>
    );
  }

  const { original, summary } = result;

  // Visual Styling helpers
  const getEaseColor = (score: number) => {
    if (score >= 70) {
      return {
        bg: 'bg-emerald-500 dark:bg-emerald-600',
        text: 'text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      };
    }
    if (score >= 50) {
      return {
        bg: 'bg-amber-500 dark:bg-amber-600',
        text: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      };
    }
    return {
      bg: 'bg-red-500 dark:bg-red-650',
      text: 'text-red-650 dark:text-red-400',
      badge: 'bg-red-500/10 text-red-650 dark:text-red-400 border-red-500/20',
    };
  };

  const originalTheme = getEaseColor(original.readingEase);
  const summaryTheme = getEaseColor(summary.readingEase);

  // Compute improvements
  const gradeDiff = original.gradeLevel - summary.gradeLevel;
  const easeDiff = summary.readingEase - original.readingEase;

  return (
    <div 
      className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 md:p-6 shadow-sm space-y-6 text-left"
      aria-label="Readability comparison analysis"
    >
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
        <h3 className="text-sm font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
          <BookOpen size={16} />
          Readability Analysis
        </h3>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 font-medium">
          <Sparkles size={12} className="text-yellow-500" />
          Flesch Metrics
        </span>
      </div>

      {/* Grid containing Original vs Summary side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Original Document column */}
        <div className="space-y-4 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-950/20 border border-gray-100 dark:border-gray-850">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Original Document
            </h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${originalTheme.badge}`}>
              {original.difficulty}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase">Grade Level</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                {original.gradeLevel}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase">Reading Ease</p>
              <p className={`text-2xl font-black mt-1 ${originalTheme.text}`}>
                {original.readingEase}
              </p>
            </div>
          </div>

          {/* Reading Ease Progress Bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              <span>Reading Ease Scale</span>
              <span>{original.readingEase} / 100</span>
            </div>
            <div 
              className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden"
              role="progressbar"
              aria-valuenow={original.readingEase}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Original document reading ease: ${original.readingEase}%`}
            >
              <div 
                className={`h-full rounded-full transition-all duration-500 ${originalTheme.bg}`}
                style={{ width: `${original.readingEase}%` }}
              />
            </div>
          </div>
        </div>

        {/* AI Summary column */}
        <div className="space-y-4 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-950/20 border border-gray-100 dark:border-gray-850">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              AI Summary
            </h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${summaryTheme.badge}`}>
              {summary.difficulty}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase">Grade Level</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                {summary.gradeLevel}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase">Reading Ease</p>
              <p className={`text-2xl font-black mt-1 ${summaryTheme.text}`}>
                {summary.readingEase}
              </p>
            </div>
          </div>

          {/* Reading Ease Progress Bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              <span>Reading Ease Scale</span>
              <span>{summary.readingEase} / 100</span>
            </div>
            <div 
              className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden"
              role="progressbar"
              aria-valuenow={summary.readingEase}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`AI generated summary reading ease: ${summary.readingEase}%`}
            >
              <div 
                className={`h-full rounded-full transition-all duration-500 ${summaryTheme.bg}`}
                style={{ width: `${summary.readingEase}%` }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Comparison and Improvement Badges */}
      <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-primary" />
            Comparison:
          </span>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded bg-gray-105 dark:bg-gray-800 text-[11px] font-bold border border-gray-200 dark:border-gray-700">
              Grade Level: {original.gradeLevel} → {summary.gradeLevel}
            </span>
            <span className="px-2 py-1 rounded bg-gray-105 dark:bg-gray-800 text-[11px] font-bold border border-gray-200 dark:border-gray-700">
              Reading Ease: {original.readingEase} → {summary.readingEase}
            </span>
          </div>
        </div>

        {/* Improvement Indicator Badges */}
        {(gradeDiff > 0 || easeDiff > 0) ? (
          <div className="flex flex-wrap gap-2.5 pt-2">
            {gradeDiff > 0 && (
              <div 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                aria-label={`Improved by ${gradeDiff} grade levels`}
              >
                <CheckCircle size={14} />
                <span>Improved by {gradeDiff} Grade Level{gradeDiff > 1 ? 's' : ''}</span>
              </div>
            )}
            {easeDiff > 0 && (
              <div 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                aria-label={`${easeDiff}% easier to read`}
              >
                <CheckCircle size={14} />
                <span>{easeDiff}% Easier to Read</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-gray-400 dark:text-gray-500 pt-1">
            No change in readability metrics.
          </div>
        )}
      </div>
    </div>
  );
}
