import React, { useState } from 'react';
import { Check, Sparkles, ChevronUp, ChevronDown, CheckCircle2, ListChecks } from 'lucide-react';

export interface CircularProgressRingProps {
  /** Number of required fields filled out */
  filledRequired: number;
  /** Total number of required fields */
  totalRequired: number;
  /** Explicit percentage override (0–100). Computed if omitted. */
  percentage?: number;
  /** Diameter of the SVG ring in pixels (default 68) */
  size?: number;
  /** Width of the ring stroke in pixels (default 6) */
  strokeWidth?: number;
  /** Label for accessibility and popover title */
  label?: string;
  /** Whether the component floats sticky in bottom-right corner */
  isFloating?: boolean;
  /** Position option when floating */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Optional array of missing field labels for the details tooltip */
  missingFieldLabels?: string[];
  /** Optional custom class name */
  className?: string;
  /** Optional callback fired when progress reaches 100% */
  onComplete?: () => void;
}

export const CircularProgressRing: React.FC<CircularProgressRingProps> = ({
  filledRequired,
  totalRequired,
  percentage: customPercentage,
  size = 68,
  strokeWidth = 6,
  label = 'Form Progress',
  isFloating = true,
  position = 'bottom-right',
  missingFieldLabels = [],
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate percentage: (filled / total) * 100
  const percentage = typeof customPercentage === 'number'
    ? Math.min(100, Math.max(0, Math.round(customPercentage)))
    : totalRequired > 0
      ? Math.min(100, Math.max(0, Math.round((filledRequired / totalRequired) * 100)))
      : 0;

  const isComplete = percentage === 100 && totalRequired > 0;

  // SVG calculations for circle perimeter
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Positioning classes
  const getPositionClasses = () => {
    if (!isFloating) return 'relative inline-flex items-center';
    switch (position) {
      case 'bottom-left':
        return 'fixed bottom-5 left-5 md:bottom-6 md:left-6 z-50';
      case 'top-right':
        return 'fixed top-20 right-5 md:top-20 md:right-6 z-50';
      case 'top-left':
        return 'fixed top-20 left-5 md:top-20 md:left-6 z-50';
      case 'bottom-right':
      default:
        return 'fixed bottom-5 right-5 md:bottom-6 md:right-6 z-50';
    }
  };

  return (
    <div
      className={`${getPositionClasses()} ${className}`}
      data-testid="circular-progress-ring-container"
    >
      <div className="relative group flex flex-col items-end">
        {/* Expanded Details Popover Card */}
        {isExpanded && (
          <div
            className="mb-3 w-72 p-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-100 animate-slide-up transition-all z-10"
            data-testid="progress-details-card"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-150 dark:border-gray-800">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300">
                <ListChecks size={16} className={isComplete ? 'text-emerald-500' : 'text-primary-600'} />
                <span>{label}</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close details"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="py-3">
              <div className="flex items-center justify-between text-sm font-semibold mb-1">
                <span>Required Fields</span>
                <span className={`font-bold ${isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary-600 dark:text-primary-400'}`}>
                  {filledRequired} / {totalRequired} ({percentage}%)
                </span>
              </div>

              {/* Mini progress bar inside card */}
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden my-2">
                <div
                  className={`h-full transition-all duration-500 ease-out ${
                    isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-primary-500 to-indigo-600'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {isComplete ? (
                <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>All required intake fields completed! Ready to submit.</span>
                </div>
              ) : missingFieldLabels.length > 0 ? (
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Remaining to fill:</p>
                  <ul className="text-xs space-y-1 max-h-32 overflow-y-auto pr-1">
                    {missingFieldLabels.map((lbl, idx) => (
                      <li key={idx} className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">{lbl}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Fill out required fields to complete the legal form.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Main Floating Ring Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={`${label}: ${percentage}% complete (${filledRequired} of ${totalRequired} required fields)`}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          className={`group relative flex items-center justify-center p-2.5 rounded-full shadow-xl transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-4 ${
            isComplete
              ? 'bg-emerald-500/15 dark:bg-emerald-950/50 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500/30 shadow-emerald-500/20'
              : 'bg-white/90 dark:bg-gray-900/90 hover:bg-white dark:hover:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-100 focus:ring-primary-500/30 shadow-primary-500/10'
          } backdrop-blur-md`}
        >
          {/* SVG Progress Ring */}
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg
              width={size}
              height={size}
              className="transform -rotate-90"
              style={{ width: size, height: size }}
            >
              {/* Background Track Circle */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                className={`transition-colors duration-300 ${
                  isComplete
                    ? 'stroke-emerald-200 dark:stroke-emerald-900/40'
                    : 'stroke-gray-200 dark:stroke-gray-800'
                }`}
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Animated Progress Circle */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                className={`transition-all duration-500 ease-out ${
                  isComplete
                    ? 'stroke-emerald-500 dark:stroke-emerald-400'
                    : 'stroke-primary-600 dark:stroke-primary-400'
                }`}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Content inside Ring Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              {isComplete ? (
                <div className="flex flex-col items-center justify-center animate-bounce-short">
                  <Check size={size * 0.32} className="text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 leading-none">
                    100%
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <span className="text-xs font-black tracking-tighter text-gray-900 dark:text-white leading-none">
                    {percentage}%
                  </span>
                  <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 mt-0.5 leading-none">
                    {filledRequired}/{totalRequired}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Toggle Indicator Arrow / Badge */}
          <div className="absolute -top-1 -right-1 flex items-center justify-center">
            {isComplete ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md animate-pulse">
                <Sparkles size={11} />
              </span>
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white shadow-md text-[10px] font-bold">
                {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
